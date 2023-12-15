import { Context, Effect, Layer, Stream } from "effect"
import Jimp from "jimp"
import { Schema } from "@effect/schema"

export class ColorError extends Schema.TaggedError<ColorError>()("ColorError", {
  message: Schema.string,
}) {}

const make = Effect.gen(function* (_) {
  const open = (path: string) =>
    Effect.tryPromise({
      try: () => Jimp.read(path) as Promise<Jimp>,
      catch: error => new ColorError({ message: `${error}` }),
    })

  const colorFromJimp = (
    image: Jimp,
    left = 0,
    top = 0,
    width = image.bitmap.width,
    height = image.bitmap.height,
  ) =>
    Effect.async<never, never, RGB>(resume => {
      let r = 0,
        g = 0,
        b = 0
      let i = 0
      image.scan(left, top, width, height, function (x, y, idx) {
        r += image.bitmap.data[idx + 0]
        g += image.bitmap.data[idx + 1]
        b += image.bitmap.data[idx + 2]
        i++
        if (x === left + width - 1 && y === top + height - 1) {
          resume(
            Effect.succeed(
              new RGB({
                r: Math.round(r / i),
                g: Math.round(g / i),
                b: Math.round(b / i),
              }),
            ),
          )
        }
      })
    })

  const color = (path: string) =>
    open(path).pipe(
      Effect.flatMap(colorFromJimp),
      Effect.orElseSucceed(() => new RGB({ r: 0, g: 0, b: 0 })),
    )

  const colorGrid = ({
    path,
    columns,
    rows = columns,
    shard = 0,
    totalShards = 1,
  }: {
    readonly path: string
    readonly columns: number
    readonly rows?: number
    readonly shard?: number
    readonly totalShards?: number
  }) =>
    Effect.gen(function* (_) {
      const image = yield* _(open(path))
      const height = image.bitmap.height
      const width = image.bitmap.width

      const columnWidth = Math.floor(width / columns)
      const rowHeight = Math.floor(height / rows)

      const startRow = Math.round((rows / totalShards) * shard)
      const endRow = Math.round((rows / totalShards) * (shard + 1))

      return Stream.range(startRow, endRow - 1).pipe(
        Stream.flatMap(y =>
          Stream.range(0, columns - 1).pipe(Stream.map(x => [x, y])),
        ),
        Stream.mapEffect(
          ([xi, yi]) => {
            const x = xi * columnWidth
            const y = yi * rowHeight
            return colorFromJimp(image, x, y, columnWidth, rowHeight).pipe(
              Effect.map(rgb => new RGBTile({ rgb, x: xi, y: yi })),
            )
          },
          { concurrency: 3 },
        ),
      )
    }).pipe(Stream.unwrap)

  return { color, colorGrid } as const
})

export interface Colors {
  readonly _: unique symbol
}
export const Colors = Context.Tag<Colors, Effect.Effect.Success<typeof make>>(
  "@app/image/Colors",
)
export const ColorsLive = Layer.effect(Colors, make)

export class RGB extends Schema.Class<RGB>()({
  r: Schema.Int,
  g: Schema.Int,
  b: Schema.Int,
}) {
  distance(rgb: RGB) {
    const diff_r = rgb.r - this.r
    const diff_g = rgb.g - this.g
    const diff_b = rgb.b - this.b
    const distance = Math.sqrt(
      diff_r * diff_r + diff_g * diff_g + diff_b * diff_b,
    )
    return distance
  }
}

export class RGBTile extends Schema.Class<RGBTile>()({
  rgb: RGB,
  x: Schema.Int,
  y: Schema.Int,
}) {}
