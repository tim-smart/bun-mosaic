import * as OS from "node:os"

export const concurrency = OS.cpus().length
