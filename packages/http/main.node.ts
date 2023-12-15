import { HttpLive } from "@app/http/Http"
import { ImageDirectory } from "@app/image/Sources"
import { ImageWorkerLive } from "@app/image/Worker/schema"
import { WatchDirectory } from "@app/watcher/Watcher"
import * as Http from "@effect/platform-node/HttpServer"
import * as KVS from "@effect/platform-node/KeyValueStore"
import * as NodeContext from "@effect/platform-node/NodeContext"
import { runMain } from "@effect/platform-node/Runtime"
import * as Worker from "@effect/platform-node/Worker"
import { Effect, Layer } from "effect"
import { createServer } from "node:http"
import * as WT from "node:worker_threads"

const Server = Http.server.layer(createServer, {
  host: "0.0.0.0",
  port: 3001,
})

const WorkerLive = ImageWorkerLive(
  () =>
    new WT.Worker(new URL("../image/Worker/server.node.ts", import.meta.url)),
)

const MainLive = HttpLive.pipe(
  Layer.provide(Server),
  Layer.provide(WorkerLive),
  Layer.provide(KVS.layerFileSystem(`${process.argv[3]}/_cache`)),
  Layer.provide(NodeContext.layer),
  Layer.provide(Worker.layerManager),
  Layer.provide(Layer.succeed(ImageDirectory, process.argv[2])),
  Layer.provide(Layer.succeed(WatchDirectory, process.argv[3])),
)

Layer.launch(MainLive).pipe(Effect.tapErrorCause(Effect.logError), runMain)
