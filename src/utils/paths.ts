import fs from "fs";
import os from "os";
import path from "path";

export function getUploadsDir(): string {
  const dir = process.env.VERCEL
    ? path.join(os.tmpdir(), "uploads")
    : path.join(__dirname, "../../uploads");

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.warn("Could not create uploads directory:", error);
  }

  return dir;
}
