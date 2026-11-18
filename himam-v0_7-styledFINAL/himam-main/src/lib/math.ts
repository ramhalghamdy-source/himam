import type { Point2D } from '../types/assessment';

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const distance = (a: Point2D, b: Point2D) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Point2D, b: Point2D): Point2D => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const angleDegrees = (a: Point2D, b: Point2D, c: Point2D) => {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (mag === 0) return 0;
  const cos = clamp(dot / mag, -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
};

export const mean = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

export const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
};

export const coefficientOfVariation = (values: number[]) => {
  const m = mean(values);
  return m > 0 ? standardDeviation(values) / m : 0;
};

export const emaPoint = (
  previous: Point2D | null,
  next: Point2D,
  alpha = 0.35,
): Point2D => {
  if (!previous) return next;
  return {
    x: alpha * next.x + (1 - alpha) * previous.x,
    y: alpha * next.y + (1 - alpha) * previous.y,
  };
};
