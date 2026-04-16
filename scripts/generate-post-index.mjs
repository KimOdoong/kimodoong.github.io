import { promises as fs } from "fs";
import path from "path";

const ROOT_DIR = process.cwd();
const POSTS_DIR = path.join(ROOT_DIR, "posts");
const OUTPUT_PATH = path.join(POSTS_DIR, "index.json");

async function walkMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkMarkdownFiles(absolutePath);
      results.push(...nested);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.toLowerCase().endsWith(".md")) {
      continue;
    }

    const relativePath = path.relative(POSTS_DIR, absolutePath).replace(/\\/g, "/");
    results.push(relativePath);
  }

  return results;
}

async function main() {
  const files = await walkMarkdownFiles(POSTS_DIR);
  files.sort((a, b) => a.localeCompare(b, "ko"));

  const data = { posts: files };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`생성 완료: ${OUTPUT_PATH}`);
  console.log(`포스트 개수: ${files.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});