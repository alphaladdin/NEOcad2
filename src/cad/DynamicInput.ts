import { Vector2 } from './Vector2';

/**
 * Input mode for dynamic input
 */
export enum InputMode {
  CARTESIAN = 'cartesian', // X, Y coordinates
  POLAR = 'polar', // Distance, Angle
  RELATIVE = 'relative', // Relative to last point
}

/**
 * Dynamic input field
 */
export interface InputField {
  label: string;
  value: string;
  active: boolean;
  placeholder: string;
}

/**
 * Dynamic input configuration
 */
export interface DynamicInputConfig {
  enabled: boolean;
  mode: InputMode;
  showTooltip: boolean;
  tooltipOffset: Vector2;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  activeColor: string;
  fontSize: number;
  padding: number;
}

/**
 * Dynamic input result
 */
export interface DynamicInputResult {
  point: Vector2;
  mode: InputMode;
  values: { x?: number; y?: number; distance?: number; angle?: number };
}

/**
 * DynamicInput - Real-time coordinate entry system
 * Similar to AutoCAD's dynamic input feature
 */
export class DynamicInput {
  private config: DynamicInputConfig;
  private basePoint: Vector2 | null = null;
  private fields: InputField[] = [];
  private activeFieldIndex: number = 0;
  private inputBuffer: string = '';
  private enabled: boolean = true;

  constructor(config?: Partial<DynamicInputConfig>) {
    this.config = {
      enabled: true,
      mode: InputMode.CARTESIAN,
      showTooltip: true,
      tooltipOffset: new Vector2(15, -15),
      backgroundColor: 'rgba(30, 30, 30, 0.95)',
      borderColor: 'rgba(74, 158, 255, 0.8)',
      textColor: '#ffffff',
      activeColor: '#4a9eff',
      fontSize: 12,
      padding: 8,
      ...config,
    };

    this.initializeFields();
  }

  /**
   * Initialize input fields based on mode
   */
  private initializeFields(): void {
    this.fields = [];

    switch (this.config.mode) {
      case InputMode.CARTESIAN:
        this.fields = [
          { label: 'X', value: '', active: true, placeholder: '0.00' },
          { label: 'Y', value: '', active: false, placeholder: '0.00' },
        ];
        break;

      case InputMode.POLAR:
        this.fields = [
          { label: 'Distance', value: '', active: true, placeholder: '0.00' },
          { label: 'Angle', value: '', active: false, placeholder: '0°' },
        ];
        break;

      case InputMode.RELATIVE:
        this.fields = [
          { label: 'ΔX', value: '', active: true, placeholder: '0.00' },
          { label: 'ΔY', value: '', active: false, placeholder: '0.00' },
        ];
        break;
    }

    this.activeFieldIndex = 0;
  }

  /**
   * Set base point for relative/polar input
   */
  setBasePoint(point: Vector2 | null): void {
    this.basePoint = point;
  }

  /**
   * Get base point
   */
  getBasePoint(): Vector2 | null {
    return this.basePoint;
  }

  /**
   * Set input mode
   */
  setMode(mode: InputMode): void {
    this.config.mode = mode;
    this.initializeFields();
  }

  /**
   * Get input mode
   */
  getMode(): InputMode {
    return this.config.mode;
  }

  /**
   * Handle keyboard input
   */
  handleKeyInput(key: string): boolean {
    if (!this.config.enabled) return false;

    // Numbers and decimal point
    if (/^[0-9\.\-]$/.test(key)) {
      this.inputBuffer += key;
      this.fields[this.activeFieldIndex].value = this.inputBuffer;
      return true;
    }

    // Tab - switch to next field
    if (key === 'Tab') {
      this.nextField();
      return true;
    }

    // Enter - confirm input
    if (key === 'Enter') {
      return this.confirmInput();
    }

    // Backspace
    if (key === 'Backspace') {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.fields[this.activeFieldIndex].value = this.inputBuffer;
      return true;
    }

    // Comma - switch to next field (like AutoCAD)
    if (key === ',') {
      this.nextField();
      return true;
    }

    // @ - Toggle relative mode
    if (key === '@') {
      this.setMode(InputMode.RELATIVE);
      return true;
    }

    // < - Switch to polar mode (angle input)
    if (key === '<') {
      if (this.config.mode !== InputMode.POLAR) {
        this.setMode(InputMode.POLAR);
      }
      return true;
    }

    return false;
  }

  /**
   * Move to next input field
   */
  nextField(): void {
    if (this.fields[this.activeFieldIndex].value) {
      this.fields[this.activeFieldIndex].active = false;
      this.activeFieldIndex = (this.activeFieldIndex + 1) % this.fields.length;
      this.fields[this.activeFieldIndex].active = true;
      this.inputBuffer = this.fields[this.activeFieldIndex].value;
    }
  }

  /**
   * Confirm input and calculate result
   */
  confirmInput(): boolean {
    const result = this.calculateResult();
    if (result) {
      this.reset();
      return true;
    }
    return false;
  }

  /**
   * Calculate result point from input
   */
  calculateResult(): DynamicInputResult | null {
    const values: any = {};

    // Parse input values
    this.fields.forEach((field) => {
      const value = parseFloat(field.value);
      if (!isNaN(value)) {
        if (field.label === 'X' || field.label === 'ΔX') values.x = value;
        if (field.label === 'Y' || field.label === 'ΔY') values.y = value;
        if (field.label === 'Distance') values.distance = value;
        if (field.label === 'Angle') values.angle = value;
      }
    });

    let point: Vector2;

    switch (this.config.mode) {
      case InputMode.CARTESIAN:
        if (values.x !== undefined && values.y !== undefined) {
          point = new Vector2(values.x, values.y);
        } else {
          return null;
        }
        break;

      case InputMode.POLAR:
        if (values.distance !== undefined && values.angle !== undefined && this.basePoint) {
          const angleRad = (values.angle * Math.PI) / 180;
          point = this.basePoint.clone().add(
            Vector2.fromAngle(angleRad, values.distance)
          );
          values.x = point.x;
          values.y = point.y;
        } else {
          return null;
        }
        break;

      case InputMode.RELATIVE:
        if (values.x !== undefined && values.y !== undefined && this.basePoint) {
          point = this.basePoint.clone().add(new Vector2(values.x, values.y));
          values.x = point.x;
          values.y = point.y;
        } else {
          return null;
        }
        break;

      default:
        return null;
    }

    return {
      point,
      mode: this.config.mode,
      values,
    };
  }

  /**
   * Update display with cursor position
   */
  updateFromCursor(cursorWorld: Vector2, basePoint?: Vector2): void {
    const base = basePoint || this.basePoint;
    if (!base) return;

    const delta = Vector2.fromPoints(base, cursorWorld);
    const distance = delta.length();
    const angle = (delta.angle() * 180) / Math.PI;

    // Update fields if not actively typing
    if (!this.inputBuffer) {
      switch (this.config.mode) {
        case InputMode.CARTESIAN:
          if (!this.fields[0].value) {
            this.fields[0].value = cursorWorld.x.toFixed(3);
          }
          if (!this.fields[1].value) {
            this.fields[1].value = cursorWorld.y.toFixed(3);
          }
          break;

        case InputMode.POLAR:
          if (!this.fields[0].value) {
            this.fields[0].value = distance.toFixed(3);
          }
          if (!this.fields[1].value) {
            let displayAngle = angle;
            while (displayAngle < 0) displayAngle += 360;
            while (displayAngle >= 360) displayAngle -= 360;
            this.fields[1].value = displayAngle.toFixed(1);
          }
          break;

        case InputMode.RELATIVE:
          if (!this.fields[0].value) {
            this.fields[0].value = delta.x.toFixed(3);
          }
          if (!this.fields[1].value) {
            this.fields[1].value = delta.y.toFixed(3);
          }
          break;
      }
    }
  }

  /**
   * Reset input fields
   */
  reset(): void {
    this.inputBuffer = '';
    this.activeFieldIndex = 0;
    this.initializeFields();
  }

  /**
   * Clear all input
   */
  clear(): void {
    this.fields.forEach((field) => {
      field.value = '';
      field.active = false;
    });
    this.fields[0].active = true;
    this.activeFieldIndex = 0;
    this.inputBuffer = '';
  }

  /**
   * Enable/disable dynamic input
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get configuration
   */
  getConfig(): DynamicInputConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DynamicInputConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Render dynamic input tooltip
   */
  renderTooltip(
    ctx: CanvasRenderingContext2D,
    cursorScreen: Vector2
  ): void {
    if (!this.config.enabled || !this.config.showTooltip) return;

    const x = cursorScreen.x + this.config.tooltipOffset.x;
    const y = cursorScreen.y + this.config.tooltipOffset.y;

    const padding = this.config.padding;
    const fontSize = this.config.fontSize;
    const lineHeight = fontSize + 4;

    ctx.save();
    ctx.font = `${fontSize}px monospace`;

    // Calculate dimensions
    let maxWidth = 0;
    this.fields.forEach((field) => {
      const text = `${field.label}: ${field.value || field.placeholder}`;
      const width = ctx.measureText(text).width;
      maxWidth = Math.max(maxWidth, width);
    });

    const width = maxWidth + padding * 2;
    const height = this.fields.length * lineHeight + padding * 2;

    // Draw background
    ctx.fillStyle = this.config.backgroundColor;
    ctx.fillRect(x, y, width, height);

    // Draw border
    ctx.strokeStyle = this.config.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw fields
    this.fields.forEach((field, index) => {
      const fieldY = y + padding + index * lineHeight + fontSize;
      const isActive = field.active;

      // Field label
      ctx.fillStyle = isActive ? this.config.activeColor : this.config.textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${field.label}:`, x + padding, fieldY);

      // Field value
      const labelWidth = ctx.measureText(`${field.label}: `).width;
      ctx.fillStyle = isActive ? this.config.activeColor : this.config.textColor;
      const displayValue = field.value || field.placeholder;
      ctx.fillText(displayValue, x + padding + labelWidth, fieldY);

      // Cursor for active field
      if (isActive && field.value) {
        const valueWidth = ctx.measureText(field.value).width;
        const cursorX = x + padding + labelWidth + valueWidth + 2;
        ctx.fillRect(cursorX, fieldY - fontSize, 1, fontSize + 2);
      }

      // Underline active field
      if (isActive) {
        const lineY = fieldY + 2;
        ctx.beginPath();
        ctx.moveTo(x + padding + labelWidth, lineY);
        ctx.lineTo(x + width - padding, lineY);
        ctx.strokeStyle = this.config.activeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  /**
   * Get input fields
   */
  getFields(): InputField[] {
    return [...this.fields];
  }

  /**
   * Get active field
   */
  getActiveField(): InputField | null {
    return this.fields[this.activeFieldIndex] || null;
  }

  /**
   * Check if any field has input
   */
  hasInput(): boolean {
    return this.fields.some((field) => field.value.length > 0);
  }
}
