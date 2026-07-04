import fs from "node:fs"
import path from "node:path"

const clientIndexPath = path.join(process.cwd(), "node_modules/.prisma/client/index.js")

if (!fs.existsSync(clientIndexPath)) {
  process.exit(0)
}

const source = fs.readFileSync(clientIndexPath, "utf8")
const fixed = source.replace(/\n\/client\/schema\.prisma"\)\n/g, "\n")

if (source !== fixed) {
  fs.writeFileSync(clientIndexPath, fixed)
  console.log("Fixed corrupted Prisma client annotation")
}
