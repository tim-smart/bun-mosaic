import { runMain } from "@effect/platform-node/Runtime"
import * as Runner from "@effect/platform-node/WorkerRunner"
import * as Server from "@effect/rpc-workers/Server"
import { Effect } from "effect"
import { router } from "./router.ts"

Server.make(router).pipe(Effect.scoped, Effect.provide(Runner.layer), runMain)
