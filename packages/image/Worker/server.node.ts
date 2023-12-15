import { RunnerLive } from "@app/image/Worker/runner"
import { runMain } from "@effect/platform-node/Runtime"
import * as Runner from "@effect/platform-node/WorkerRunner"
import { Layer } from "effect"

const MainLive = RunnerLive.pipe(Layer.provide(Runner.layerPlatform))
runMain(Layer.launch(MainLive))
