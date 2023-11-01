import { BunContext, FileSystem, Path } from "@effect/platform-bun"
import { runMain } from "@effect/platform-bun/Runtime"
import { Effect } from "effect"
import Sharp from "sharp"

const directory = process.argv[2]

const resizeImage = (image: string, dest: string) =>
  Effect.tryPromise({
    try: () =>
      Sharp(image)
        .resize({
          width: 100,
          height: 100,
          fit: "cover",
        })
        .toFormat("jpg")
        .toFile(dest),
    catch: err => err,
  })

Effect.gen(function* (_) {
  const fs = yield* _(FileSystem.FileSystem)
  const path = yield* _(Path.Path)

  const images = (yield* _(fs.readDirectory(directory))).filter(_ =>
    /\.(jpg|jpeg|png|webp)$/.test(_),
  )

  yield* _(fs.makeDirectory(path.join(directory, "_resized")))

  yield* _(
    Effect.forEach(
      images,
      image =>
        resizeImage(
          path.join(directory, image),
          path.join(directory, "_resized", image),
        ).pipe(Effect.catchAllCause(Effect.logError)),
      { concurrency: 5 },
    ),
  )
}).pipe(Effect.provide(BunContext.layer), runMain)
