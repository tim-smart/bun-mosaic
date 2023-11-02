import Module from "node:module"
const require = Module.createRequire(import.meta.url)
const module = require("./index.node")

export const calculate = (
  path: string,
  columns: number,
  row: number,
): Promise<
  ReadonlyArray<{
    readonly r: number
    readonly g: number
    readonly b: number
  }>
> => module.calculate(path, columns, row)
