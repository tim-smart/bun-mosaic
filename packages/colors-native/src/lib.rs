use color_thief;
use image::{self, ImageError};
use neon::prelude::*;
use once_cell::sync::OnceCell;
use serde::Deserialize;
use tokio::runtime::Runtime;

#[derive(Deserialize, Default, Clone)]
struct RGB {
    r: u8,
    g: u8,
    b: u8,
}

fn runtime<'a, C: Context<'a>>(cx: &mut C) -> NeonResult<&'static Runtime> {
    static RUNTIME: OnceCell<Runtime> = OnceCell::new();

    RUNTIME.get_or_try_init(|| Runtime::new().or_else(|err| cx.throw_error(err.to_string())))
}

fn calculate_colors(path: &str, columns: u32, row: u32) -> Result<Vec<RGB>, ImageError> {
    let image = image::open(path)?;
    let width = image.width();
    let height = image.height();
    let width_per_column = width / columns;
    let height_per_row = height / columns;

    let mut grid = vec![RGB::default(); columns as usize];

    for x in 0..columns {
        let color = color_from_crop(
            &image,
            x * width_per_column,
            row * height_per_row,
            width_per_column,
            height_per_row,
        )?;
        grid[x as usize].r = color.r;
        grid[x as usize].g = color.g;
        grid[x as usize].b = color.b;
    }

    return Ok(grid);
}

fn color_from_crop(
    image: &image::DynamicImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<color_thief::Color, ImageError> {
    let crop = image.crop_imm(x, y, width, height);
    let buf = crop.to_rgb8().to_vec();
    let colors = color_thief::get_palette(&buf, color_thief::ColorFormat::Rgb, 10, 3).unwrap();
    return Ok(colors[0]);
}

fn node_calculate_colors(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let rt = runtime(&mut cx)?;
    let channel = cx.channel();

    let (deferred, promise) = cx.promise();

    let path = cx.argument::<JsString>(0)?.value(&mut cx);
    let columns = cx.argument::<JsNumber>(1)?.value(&mut cx) as u32;
    let row = cx.argument::<JsNumber>(2)?.value(&mut cx) as u32;

    rt.spawn(async move {
        let colors = calculate_colors(&path, columns, row).unwrap();

        deferred.settle_with(&channel, move |mut cx| {
            let js_colors = JsArray::new(&mut cx, colors.len() as u32);
            for (i, color) in colors.iter().enumerate() {
                let js_color = JsObject::new(&mut cx);
                js_color.set(&mut cx, "r", cx.number(color.r)).unwrap();
                js_color.set(&mut cx, "g", cx.number(color.g)).unwrap();
                js_color.set(&mut cx, "b", cx.number(color.b)).unwrap();
                js_colors.set(&mut cx, i as u32, js_color).unwrap();
            }
            Ok(js_colors)
        });
    });

    Ok(promise)
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("calculate", node_calculate_colors)?;
    Ok(())
}
