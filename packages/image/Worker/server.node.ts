import { runMain } from "@effect/platform-node/Runtime"
import * as Runner from "@effect/platform-node/WorkerRunner"
import * as Server from "@effect/rpc-workers/Server"
import { Effect, Layer } from "effect"
import { ColorsLive } from "../Colors.ts"
import { router } from "./router.ts"

Server.make(router).pipe(
  Effect.scoped,
  Effect.provide(Layer.merge(Runner.layer, ColorsLive)),
  runMain,
)
