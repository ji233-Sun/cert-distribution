import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Elysia } from "elysia";
import {
  sendCertificateReminderEmail,
  sendVerificationCodeEmail,
} from "./lib/email";
import {
  deleteStoredFile,
  isValidQQNumber,
  parseBatchFileName,
  saveUploadedFile,
} from "./lib/files";
import { prisma } from "./lib/prisma";
import {
  clearAdminSessionCookie,
  clearUserSessionCookie,
  createAdminSessionCookie,
  createUserSessionCookie,
  getAdminSession,
  getUserSession,
} from "./lib/session";
import {
  renderAdminDashboardPage,
  renderAdminLoginPage,
  renderDashboardPage,
  renderHomePage,
} from "./lib/views";

const host = process.env.HOST?.trim() || "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const buildUrl = (path: string, params?: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        searchParams.set(key, value);
      }
    }
  }

  const query = searchParams.toString();

  return query ? `${path}?${query}` : path;
};

const redirect = (location: string, setCookie?: string) => {
  const headers = new Headers({
    Location: location,
  });

  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }

  return new Response(null, {
    status: 303,
    headers,
  });
};

const html = (content: string) =>
  new Response(content, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

const getSearchValue = (request: Request, key: string) =>
  new URL(request.url).searchParams.get(key)?.trim() || undefined;

const cleanupExpiredCodes = async () => {
  await prisma.verificationCode.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
};

const createVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

type ReminderRecipient = {
  qqNumber: string;
  ownerNames: string[];
  certificateCount: number;
};

const buildReminderRecipients = (
  certificates: Array<{ qqNumber: string; ownerName: string }>
): ReminderRecipient[] => {
  const recipientMap = new Map<
    string,
    {
      ownerNames: Set<string>;
      certificateCount: number;
    }
  >();

  for (const certificate of certificates) {
    const recipient =
      recipientMap.get(certificate.qqNumber) ??
      {
        ownerNames: new Set<string>(),
        certificateCount: 0,
      };

    if (certificate.ownerName) {
      recipient.ownerNames.add(certificate.ownerName);
    }

    recipient.certificateCount += 1;
    recipientMap.set(certificate.qqNumber, recipient);
  }

  return Array.from(recipientMap, ([qqNumber, recipient]) => ({
    qqNumber,
    ownerNames: Array.from(recipient.ownerNames),
    certificateCount: recipient.certificateCount,
  }));
};

const summarizeReminderFailures = (
  failedRecipients: Array<{ qqNumber: string; reason: string }>
) => {
  if (failedRecipients.length === 0) {
    return undefined;
  }

  const preview = failedRecipients
    .slice(0, 3)
    .map(
      ({ qqNumber, reason }) =>
        `${qqNumber}@qq.com（${reason.slice(0, 60)}${reason.length > 60 ? "..." : ""}）`
    )
    .join("；");

  if (failedRecipients.length > 3) {
    return `以下 ${failedRecipients.length} 个邮箱发送失败，其中包括：${preview}`;
  }

  return `发送失败：${preview}`;
};

const saveCertificateRecord = async ({
  qqNumber,
  ownerName,
  certificateFile,
}: {
  qqNumber: string;
  ownerName: string;
  certificateFile: File;
}) => {
  const storedFile = await saveUploadedFile(certificateFile);

  try {
    return await prisma.certificate.create({
      data: {
        qqNumber,
        ownerName,
        filePath: storedFile.filePath,
        originalFileName: storedFile.originalFileName,
      },
    });
  } catch (error) {
    await deleteStoredFile(storedFile.filePath);
    throw error;
  }
};

const importCertificateByFileName = async (certificateFile: File) => {
  const parsed = parseBatchFileName(certificateFile.name);

  if (!parsed) {
    throw new Error("命名不符合 QQ号_姓名.扩展名 格式。");
  }

  return saveCertificateRecord({
    qqNumber: parsed.qqNumber,
    ownerName: parsed.ownerName,
    certificateFile,
  });
};

const getOwnedCertificate = async (request: Request, certificateId: string) => {
  const adminSession = getAdminSession(request.headers.get("cookie"));
  const userSession = getUserSession(request.headers.get("cookie"));

  if (!adminSession && !userSession) {
    return {
      error: redirect(buildUrl("/", { error: "请先完成登录验证。" })),
    };
  }

  const certificate = await prisma.certificate.findUnique({
    where: {
      id: certificateId,
    },
  });

  if (!certificate) {
    return {
      error: redirect(buildUrl("/dashboard", { error: "证书不存在或已被删除。" })),
    };
  }

  if (!adminSession && userSession?.qqNumber !== certificate.qqNumber) {
    return {
      error: redirect(buildUrl("/dashboard", { error: "您无权访问该证书。" })),
    };
  }

  return {
    certificate,
  };
};

export const app = new Elysia()
  .get("/", async ({ request }) => {
    const userSession = getUserSession(request.headers.get("cookie"));

    if (userSession) {
      return redirect("/dashboard");
    }

    const step = getSearchValue(request, "step") === "verify" ? "verify" : "qq";
    const qqNumber = getSearchValue(request, "qqNumber");
    const message = getSearchValue(request, "message");
    const error = getSearchValue(request, "error");

    return html(
      renderHomePage({
        step,
        qqNumber,
        message,
        error,
      })
    );
  })
  .post("/auth/send-code", async ({ request }) => {
    const formData = await request.formData();
    const qqNumber = String(formData.get("qqNumber") ?? "").trim();

    if (!isValidQQNumber(qqNumber)) {
      return redirect(
        buildUrl("/", { error: "请输入正确的 QQ 号，仅支持 5 到 12 位数字。" })
      );
    }

    const code = createVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await cleanupExpiredCodes();
    await prisma.verificationCode.deleteMany({
      where: {
        qqNumber,
      },
    });

    const verificationCode = await prisma.verificationCode.create({
      data: {
        qqNumber,
        code,
        expiresAt,
      },
    });

    try {
      await sendVerificationCodeEmail(qqNumber, code);
    } catch (error) {
      await prisma.verificationCode.delete({
        where: {
          id: verificationCode.id,
        },
      });

      return redirect(
        buildUrl("/", {
          error:
            error instanceof Error
              ? error.message
              : "验证码发送失败，请稍后重试。",
        })
      );
    }

    return redirect(
      buildUrl("/", {
        step: "verify",
        qqNumber,
        message: `验证码已发送至 ${qqNumber}@qq.com，请注意查收。`,
      })
    );
  })
  .post("/auth/verify", async ({ request }) => {
    const formData = await request.formData();
    const qqNumber = String(formData.get("qqNumber") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();

    if (!isValidQQNumber(qqNumber)) {
      return redirect(buildUrl("/", { error: "QQ 号格式不正确，请重新输入。" }));
    }

    if (!/^\d{6}$/.test(code)) {
      return redirect(
        buildUrl("/", {
          step: "verify",
          qqNumber,
          error: "请输入 6 位数字验证码。",
        })
      );
    }

    await cleanupExpiredCodes();

    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        qqNumber,
        code,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!verificationCode) {
      return redirect(
        buildUrl("/", {
          step: "verify",
          qqNumber,
          error: "验证码错误或已失效，请重新获取。",
        })
      );
    }

    if (verificationCode.expiresAt.getTime() <= Date.now()) {
      await prisma.verificationCode.deleteMany({
        where: {
          qqNumber,
        },
      });

      return redirect(
        buildUrl("/", {
          step: "verify",
          qqNumber,
          error: "验证码已过期，请重新获取。",
        })
      );
    }

    await prisma.verificationCode.deleteMany({
      where: {
        qqNumber,
      },
    });

    return redirect(
      buildUrl("/dashboard", { message: "验证成功，已为您加载证书列表。" }),
      createUserSessionCookie(qqNumber)
    );
  })
  .post("/logout", () =>
    redirect(
      buildUrl("/", { message: "您已安全退出登录。" }),
      clearUserSessionCookie()
    )
  )
  .get("/dashboard", async ({ request }) => {
    const userSession = getUserSession(request.headers.get("cookie"));

    if (!userSession) {
      return redirect(buildUrl("/", { error: "请先完成登录验证。" }));
    }

    const certificates = await prisma.certificate.findMany({
      where: {
        qqNumber: userSession.qqNumber,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return html(
      renderDashboardPage({
        qqNumber: userSession.qqNumber,
        certificates,
        message: getSearchValue(request, "message"),
        error: getSearchValue(request, "error"),
      })
    );
  })
  .get("/certificates/:id/download", async ({ request, params }) => {
    const result = await getOwnedCertificate(request, params.id);

    if ("error" in result) {
      return result.error;
    }

    const absolutePath = join(process.cwd(), result.certificate.filePath);

    try {
      await stat(absolutePath);
    } catch {
      return redirect(
        buildUrl("/dashboard", { error: "文件不存在，请联系管理员重新上传。" })
      );
    }

    const mode = new URL(request.url).searchParams.get("mode");
    const disposition = mode === "view" ? "inline" : "attachment";
    const file = Bun.file(absolutePath);

    return new Response(file, {
      headers: {
        "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(
          result.certificate.originalFileName || "certificate"
        )}`,
      },
    });
  })
  .get("/admin", async ({ request }) => {
    const adminSession = getAdminSession(request.headers.get("cookie"));
    const message = getSearchValue(request, "message");
    const error = getSearchValue(request, "error");

    if (!adminSession) {
      return html(
        renderAdminLoginPage({
          message,
          error,
        })
      );
    }

    const certificates = await prisma.certificate.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return html(
      renderAdminDashboardPage({
        certificates,
        message,
        error,
      })
    );
  })
  .post("/admin/login", async ({ request }) => {
    const formData = await request.formData();
    const password = String(formData.get("password") ?? "");
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();

    if (!adminPassword) {
      return redirect(
        buildUrl("/admin", { error: "未配置 ADMIN_PASSWORD，无法登录后台。" })
      );
    }

    if (password !== adminPassword) {
      return redirect(buildUrl("/admin", { error: "管理员密码错误，请重新输入。" }));
    }

    return redirect(
      buildUrl("/admin", { message: "登录成功，欢迎回来。" }),
      createAdminSessionCookie()
    );
  })
  .post("/admin/logout", () =>
    redirect(
      buildUrl("/admin", { message: "您已退出管理员后台。" }),
      clearAdminSessionCookie()
    )
  )
  .post("/admin/certificates", async ({ request }) => {
    const adminSession = getAdminSession(request.headers.get("cookie"));

    if (!adminSession) {
      return redirect(buildUrl("/admin", { error: "请先登录管理员后台。" }));
    }

    const formData = await request.formData();
    const qqNumber = String(formData.get("qqNumber") ?? "").trim();
    const ownerName = String(formData.get("ownerName") ?? "").trim();
    const certificateFile = formData.get("certificateFile");

    if (!isValidQQNumber(qqNumber)) {
      return redirect(buildUrl("/admin", { error: "请输入正确的 QQ 号。" }));
    }

    if (!ownerName) {
      return redirect(buildUrl("/admin", { error: "请填写持有人昵称。" }));
    }

    if (!(certificateFile instanceof File) || certificateFile.size === 0) {
      return redirect(buildUrl("/admin", { error: "请上传证书文件。" }));
    }

    try {
      await saveCertificateRecord({
        qqNumber,
        ownerName,
        certificateFile,
      });
    } catch (error) {
      return redirect(
        buildUrl("/admin", {
          error:
            error instanceof Error
              ? error.message
              : "保存证书失败，请稍后重试。",
        })
      );
    }

    return redirect(buildUrl("/admin", { message: "证书已成功添加。" }));
  })
  .post("/admin/certificates/import", async ({ request }) => {
    const adminSession = getAdminSession(request.headers.get("cookie"));

    if (!adminSession) {
      return json(
        {
          ok: false,
          error: "请先登录管理员后台。",
        },
        401
      );
    }

    const formData = await request.formData();
    const certificateFile = formData.get("file");

    if (!(certificateFile instanceof File) || certificateFile.size === 0) {
      return json(
        {
          ok: false,
          error: "请上传证书文件。",
        },
        400
      );
    }

    try {
      await importCertificateByFileName(certificateFile);

      return json({
        ok: true,
        fileName: certificateFile.name,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "导入失败，请稍后重试。";
      const status = message.includes("命名不符合") ? 400 : 500;

      return json(
        {
          ok: false,
          fileName: certificateFile.name,
          error: message,
        },
        status
      );
    }
  })
  .post("/admin/certificates/batch", async ({ request }) => {
    const adminSession = getAdminSession(request.headers.get("cookie"));

    if (!adminSession) {
      return redirect(buildUrl("/admin", { error: "请先登录管理员后台。" }));
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((file): file is File => file instanceof File && file.size > 0);

    if (files.length === 0) {
      return redirect(buildUrl("/admin", { error: "请至少选择一个文件。" }));
    }

    let successCount = 0;
    const failedFiles: string[] = [];

    for (const file of files) {
      try {
        await importCertificateByFileName(file);
        successCount += 1;
      } catch (error) {
        failedFiles.push(
          `${file.name}（${error instanceof Error ? error.message : "导入失败"}）`
        );
      }
    }

    const message =
      failedFiles.length === 0
        ? `批量导入完成，共成功导入 ${successCount} 个文件。`
        : `批量导入完成：成功 ${successCount} 个，失败 ${failedFiles.length} 个。`;
    const error = failedFiles.length > 0 ? failedFiles.join("；") : undefined;

    return redirect(buildUrl("/admin", { message, error }));
  })
  .post("/admin/reminders/send-all", async ({ request }) => {
    const adminSession = getAdminSession(request.headers.get("cookie"));

    if (!adminSession) {
      return redirect(buildUrl("/admin", { error: "请先登录管理员后台。" }));
    }

    const certificates = await prisma.certificate.findMany({
      select: {
        qqNumber: true,
        ownerName: true,
      },
    });

    if (certificates.length === 0) {
      return redirect(buildUrl("/admin", { error: "当前没有可发送提醒的证书记录。" }));
    }

    const reminderRecipients = buildReminderRecipients(certificates);
    let successCount = 0;
    const failedRecipients: Array<{ qqNumber: string; reason: string }> = [];

    for (const recipient of reminderRecipients) {
      try {
        await sendCertificateReminderEmail(recipient);
        successCount += 1;
      } catch (error) {
        failedRecipients.push({
          qqNumber: recipient.qqNumber,
          reason: error instanceof Error ? error.message : "发送失败，请稍后重试。",
        });
      }
    }

    const message =
      failedRecipients.length === 0
        ? `领取提醒发送完成，共通知 ${successCount} 个 QQ 邮箱。`
        : `领取提醒发送完成：成功 ${successCount} 个，失败 ${failedRecipients.length} 个。`;
    const error = summarizeReminderFailures(failedRecipients);

    return redirect(buildUrl("/admin", { message, error }));
  })
  .post("/admin/certificates/:id/delete", async ({ request, params }) => {
    const adminSession = getAdminSession(request.headers.get("cookie"));

    if (!adminSession) {
      return redirect(buildUrl("/admin", { error: "请先登录管理员后台。" }));
    }

    const certificate = await prisma.certificate.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!certificate) {
      return redirect(buildUrl("/admin", { error: "证书不存在或已被删除。" }));
    }

    await prisma.certificate.delete({
      where: {
        id: certificate.id,
      },
    });
    await deleteStoredFile(certificate.filePath);

    return redirect(buildUrl("/admin", { message: "证书已删除。" }));
  })
  .get("/health/db", async ({ set }) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
      };
    } catch (error) {
      set.status = 500;

      return {
        ok: false,
        error: error instanceof Error ? error.message : "数据库连接失败",
      };
    }
  });

if (import.meta.main) {
  app.listen({
    hostname: host,
    port,
  });

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}
