import { Colors } from "../Colors.ts"
import { schema } from "./schema.ts"
import * as Router from "@effect/rpc-workers/Router"
import { Effect, Stream } from "effect"

export const router = Router.make(schema, {
  getColor: path => Effect.flatMap(Colors, _ => _.color(path)),
  getTiles: options =>
    Effect.flatMap(Colors, _ =>
      _.getClosestGrid(options).pipe(Stream.runCollect),
    ),
})
