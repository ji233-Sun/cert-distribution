import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

const UPLOAD_DIRECTORY = join(process.cwd(), "storage", "uploads");

const normalizeRelativePath = (filePath: string) => filePath.replaceAll("\\", "/");

export const isValidQQNumber = (value: string) => /^\d{5,12}$/.test(value);

export const saveUploadedFile = async (file: File) => {
  if (!file.name || file.size === 0) {
    throw new Error("请选择有效的证书文件。");
  }

  await mkdir(UPLOAD_DIRECTORY, { recursive: true });

  const extension = extname(file.name).toLowerCase() || ".bin";
  const storedFileName = `${randomUUID()}${extension}`;
  const absolutePath = join(UPLOAD_DIRECTORY, storedFileName);
  const relativePath = normalizeRelativePath(
    relative(process.cwd(), absolutePath)
  );
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, buffer);

  return {
    filePath: relativePath,
    originalFileName: file.name,
  };
};

export const deleteStoredFile = async (filePath: string) => {
  try {
    await unlink(join(process.cwd(), filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

export const parseBatchFileName = (fileName: string) => {
  const extension = extname(fileName);
  const baseName = basename(fileName, extension);
  const separatorIndex = baseName.indexOf("_");

  if (separatorIndex <= 0) {
    return null;
  }

  const qqNumber = baseName.slice(0, separatorIndex).trim();
  const ownerName = baseName.slice(separatorIndex + 1).trim();

  if (!isValidQQNumber(qqNumber) || !ownerName) {
    return null;
  }

  return {
    qqNumber,
    ownerName,
  };
};
