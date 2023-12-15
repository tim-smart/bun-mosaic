import { ImageDirectory } from "@app/image/Sources"
import { ImageWorkerLive } from "@app/image/Worker/schema"
import { WatchDirectory } from "@app/watcher/Watcher"
import * as BunContext from "@effect/platform-bun/BunContext"
import * as Http from "@effect/platform-bun/HttpServer"
import * as KVS from "@effect/platform-bun/KeyValueStore"
import { runMain } from "@effect/platform-bun/Runtime"
import * as Worker from "@effect/platform-bun/Worker"
import { Effect, Layer } from "effect"
import { HttpLive } from "./Http.ts"

const Server = Http.server.layer({
  hostname: "0.0.0.0",
  port: 3000,
})

const WorkerLive = ImageWorkerLive(
  () =>
    new globalThis.Worker(
      new URL("../image/Worker/server.bun.ts", import.meta.url),
    ),
)

const MainLive = HttpLive.pipe(
  Layer.provide(Server),
  Layer.provide(WorkerLive),
  Layer.provide(KVS.layerFileSystem(`${process.argv[3]}/_cache`)),
  Layer.provide(BunContext.layer),
  Layer.provide(Worker.layerManager),
  Layer.provide(Layer.succeed(ImageDirectory, process.argv[2])),
  Layer.provide(Layer.succeed(WatchDirectory, process.argv[3])),
)

Layer.launch(MainLive).pipe(Effect.tapErrorCause(Effect.logError), runMain)
