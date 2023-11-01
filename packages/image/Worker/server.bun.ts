import { runMain } from "@effect/platform-bun/Runtime"
import * as Runner from "@effect/platform-bun/WorkerRunner"
import * as Server from "@effect/rpc-workers/Server"
import { Effect } from "effect"
import { router } from "./router"

Server.make(router).pipe(Effect.scoped, Effect.provide(Runner.layer), runMain)
