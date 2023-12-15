import { RunnerLive } from "@app/image/Worker/runner"
import { runMain } from "@effect/platform-bun/Runtime"
import * as Runner from "@effect/platform-bun/WorkerRunner"
import { Layer } from "effect"

const MainLive = RunnerLive.pipe(Layer.provide(Runner.layerPlatform))
runMain(Layer.launch(MainLive))
