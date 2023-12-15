import { Rx, RxRef } from "@effect-rx/rx-react"
import * as Http from "@effect/platform-browser/HttpClient"
import * as Schema from "@effect/schema/Schema"
import { Chunk, Effect, Schedule, Stream } from "effect"

export class ImageTile extends Schema.Class<ImageTile>()({
  path: Schema.string,
  x: Schema.number,
  y: Schema.number,
}) {}

const parseTiles = Schema.compose(
  Schema.ParseJson,
  Schema.chunk(ImageTile),
).pipe(Schema.decode)

const make = (url: URL) =>
  Effect.gen(function* (_) {
    const baseUrl = url.origin
    const client = Http.client
      .fetchOk()
      .pipe(Http.client.mapRequest(Http.request.prependUrl(baseUrl)))

    const grid = Array.from({ length: 100 }, () =>
      Array.from({ length: 100 }, () =>
        RxRef.make<undefined | string>(undefined),
      ),
    )

    const stream = Http.request.get("/stream").pipe(
      client,
      Effect.map(r => r.stream),
      Stream.unwrap,
      Stream.decodeText(),
      Stream.splitLines,
      Stream.mapEffect(parseTiles),
      Stream.tap(chunk =>
        Effect.sync(() => {
          Chunk.forEach(
            chunk,
            tile => grid[tile.y]?.[tile.x]?.set(baseUrl + tile.path),
          )
        }),
      ),
      Stream.retry(Schedule.spaced("3 seconds")),
    )

    yield* _(Stream.runDrain(stream), Effect.forkScoped)

    return grid
  })

// rx

export const gridRx = Rx.family((url: URL) => Rx.make(make(url)))
