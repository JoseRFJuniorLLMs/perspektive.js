use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Serialize, Deserialize)]
pub struct GeodesicResult {
    pub cx: f64,
    pub cy: f64,
    pub radius: f64,
    pub is_linear: bool,
}

#[wasm_bindgen]
pub fn poincare_distance(p1: JsValue, p2: JsValue) -> Result<f64, JsValue> {
    let p1: Point2D = serde_wasm_bindgen::from_value(p1)?;
    let p2: Point2D = serde_wasm_bindgen::from_value(p2)?;
    
    let dist_sq = (p1.x - p2.x).powi(2) + (p1.y - p2.y).powi(2);
    let norm1_sq = p1.x.powi(2) + p1.y.powi(2);
    let norm2_sq = p2.x.powi(2) + p2.y.powi(2);
    
    let denom = (1.0 - norm1_sq) * (1.0 - norm2_sq);
    if denom <= 0.0 {
        return Ok(0.0);
    }
    
    let arg = 1.0 + 2.0 * dist_sq / denom;
    Ok(arg.acosh())
}

#[wasm_bindgen]
pub fn calculate_geodesic(p1: JsValue, p2: JsValue) -> Result<JsValue, JsValue> {
    let p1: Point2D = serde_wasm_bindgen::from_value(p1)?;
    let p2: Point2D = serde_wasm_bindgen::from_value(p2)?;
    
    // Check for collinearity with origin (linear geodesic)
    let cross_product = p1.x * p2.y - p2.x * p1.y;
    if cross_product.abs() < 1e-10 {
        return Ok(serde_wasm_bindgen::to_value(&GeodesicResult {
            cx: 0.0,
            cy: 0.0,
            radius: 0.0,
            is_linear: true,
        })?);
    }
    
    let p1_sq = p1.x.powi(2) + p1.y.powi(2);
    let p2_sq = p2.x.powi(2) + p2.y.powi(2);
    
    // Cramer's Rule for orthogonal circle center
    let common_denom = 2.0 * cross_product;
    let cx = ((1.0 + p1_sq) * p2.y - (1.0 + p2_sq) * p1.y) / common_denom;
    let cy = (p1.x * (1.0 + p2_sq) - p2.x * (1.0 + p1_sq)) / common_denom;
    let radius = (cx.powi(2) + cy.powi(2) - 1.0).sqrt();
    
    Ok(serde_wasm_bindgen::to_value(&GeodesicResult {
        cx,
        cy,
        radius,
        is_linear: false,
    })?)
}

#[wasm_bindgen]
pub fn stereographic_project(p: JsValue) -> Result<JsValue, JsValue> {
    let p: Point2D = serde_wasm_bindgen::from_value(p)?;
    let r_sq = p.x.powi(2) + p.y.powi(2);
    let denom = 1.0 + r_sq;
    
    Ok(serde_wasm_bindgen::to_value(&Point3D {
        x: 2.0 * p.x / denom,
        y: 2.0 * p.y / denom,
        z: (r_sq - 1.0) / denom,
    })?)
}

#[wasm_bindgen]
pub fn conformal_factor(p: JsValue) -> Result<f64, JsValue> {
    let p: Point2D = serde_wasm_bindgen::from_value(p)?;
    let r_sq = p.x.powi(2) + p.y.powi(2);
    Ok(2.0 / (1.0 - r_sq).max(1e-10))
}
