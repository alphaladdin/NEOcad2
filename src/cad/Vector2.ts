/**
 * 2D Vector utility class for CAD operations
 */
export class Vector2 {
  constructor(public x: number = 0, public y: number = 0) {}

  /**
   * Create a copy of this vector
   */
  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  /**
   * Copy values from another vector
   */
  copy(v: Vector2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  /**
   * Set vector components
   */
  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Add another vector to this vector
   */
  add(v: Vector2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /**
   * Subtract another vector from this vector
   */
  sub(v: Vector2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /**
   * Multiply this vector by a scalar
   */
  multiplyScalar(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Divide this vector by a scalar
   */
  divideScalar(scalar: number): this {
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  /**
   * Calculate the length (magnitude) of this vector
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Calculate the squared length of this vector (faster than length())
   */
  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normalize this vector (make it unit length)
   */
  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.divideScalar(len);
    }
    return this;
  }

  /**
   * Calculate the distance to another vector
   */
  distanceTo(v: Vector2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate the squared distance to another vector (faster than distanceTo())
   */
  distanceToSquared(v: Vector2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  /**
   * Calculate the dot product with another vector
   */
  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Calculate the cross product with another vector (returns scalar in 2D)
   */
  cross(v: Vector2): number {
    return this.x * v.y - this.y * v.x;
  }

  /**
   * Calculate the angle of this vector (in radians)
   */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Calculate the angle to another vector (in radians)
   */
  angleTo(v: Vector2): number {
    const denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (denominator === 0) return Math.PI / 2;
    const theta = this.dot(v) / denominator;
    return Math.acos(Math.max(-1, Math.min(1, theta)));
  }

  /**
   * Rotate this vector by an angle (in radians)
   */
  rotate(angle: number): this {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = this.x * cos - this.y * sin;
    const y = this.x * sin + this.y * cos;
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Lerp (linear interpolation) to another vector
   */
  lerp(v: Vector2, alpha: number): this {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    return this;
  }

  /**
   * Check if this vector equals another vector
   */
  equals(v: Vector2): boolean {
    return this.x === v.x && this.y === v.y;
  }

  /**
   * Check if this vector approximately equals another vector
   */
  equalsEpsilon(v: Vector2, epsilon: number = 0.0001): boolean {
    return (
      Math.abs(this.x - v.x) < epsilon &&
      Math.abs(this.y - v.y) < epsilon
    );
  }

  /**
   * Create a vector from an angle and length
   */
  static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  /**
   * Create a vector from two points (from start to end)
   */
  static fromPoints(start: Vector2, end: Vector2): Vector2 {
    return new Vector2(end.x - start.x, end.y - start.y);
  }

  /**
   * Linear interpolation between two vectors
   */
  static lerp(v1: Vector2, v2: Vector2, alpha: number): Vector2 {
    return new Vector2(
      v1.x + (v2.x - v1.x) * alpha,
      v1.y + (v2.y - v1.y) * alpha
    );
  }

  /**
   * Convert to string for debugging
   */
  toString(): string {
    return `Vector2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
  }

  /**
   * Convert to array
   */
  toArray(): [number, number] {
    return [this.x, this.y];
  }

  /**
   * Create from array
   */
  static fromArray(arr: [number, number]): Vector2 {
    return new Vector2(arr[0], arr[1]);
  }
}
