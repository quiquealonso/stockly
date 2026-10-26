import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Scroll horizontal usable en cualquier dispositivo: con el dedo (nativo), arrastrando
 * con el ratón y con la rueda vertical. Evita el "click" al soltar tras arrastrar.
 */
@Directive({
  selector: '[appDragScroll]',
  host: {
    '(wheel)': 'onWheel($event)',
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp()',
    '(pointercancel)': 'onUp()',
  },
})
export class DragScroll {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private startX = 0;
  private startScroll = 0;
  private dragging = false;
  private moved = false;

  constructor() {
    // En fase de captura, para cancelar el click antes de que llegue al chip.
    this.el.addEventListener('click', (e) => this.onClick(e), true);
  }

  protected onWheel(e: WheelEvent) {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (this.el.scrollWidth <= this.el.clientWidth) return;
    this.el.scrollLeft += e.deltaY;
    e.preventDefault();
  }

  protected onDown(e: PointerEvent) {
    // El táctil ya hace scroll nativo; solo gestionamos el ratón.
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    this.dragging = true;
    this.moved = false;
    this.startX = e.clientX;
    this.startScroll = this.el.scrollLeft;
  }

  protected onMove(e: PointerEvent) {
    if (!this.dragging) return;
    const dx = e.clientX - this.startX;
    if (Math.abs(dx) > 5) this.moved = true;
    this.el.scrollLeft = this.startScroll - dx;
  }

  protected onUp() {
    this.dragging = false;
  }

  private onClick(e: MouseEvent) {
    if (!this.moved) return;
    e.stopPropagation();
    e.preventDefault();
    this.moved = false;
  }
}
