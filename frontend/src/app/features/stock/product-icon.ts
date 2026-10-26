import { Component, computed, input } from '@angular/core';
import { Unit } from '../../core/models';

type IconKind = 'keg' | 'can' | 'bottle' | 'liquid' | 'weight' | 'box' | 'pack' | 'item';

/** Palabras del nombre que mandan sobre la unidad (un "barril" se cuenta en unidades). */
const NAME_HINTS: [RegExp, IconKind][] = [
  [/barril/i, 'keg'],
  [/\blata|red ?bull|refresco|cola\b|monster|aquarius|nestea/i, 'can'],
  [/botell|vino|cava|ron|whisk|ginebra|gin\b|vodka|tequila|an[ií]s|licor|seagram|beefeater/i, 'bottle'],
];

const BY_UNIT: Record<Unit, IconKind> = {
  BOTTLE: 'bottle',
  L: 'liquid',
  ML: 'liquid',
  KG: 'weight',
  G: 'weight',
  BOX: 'box',
  PACK: 'pack',
  UNIT: 'item',
};

/** Icono genérico de producto (SVG propio, sin imágenes externas). Solo se usa en Stock. */
@Component({
  selector: 'app-product-icon',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @switch (kind()) {
        @case ('keg') {
          <path d="M6 3h12v2.5c1 .9 1.5 2.1 1.5 3.5v6c0 1.4-.5 2.6-1.5 3.5V21H6v-2.5C5 17.6 4.5 16.4 4.5 15V9c0-1.4.5-2.6 1.5-3.5V3zm2 2v1.4l-.3.3C6.9 7.4 6.5 8.2 6.5 9v1h11V9c0-.8-.4-1.6-1.2-2.3L16 6.4V5H8zm-1.5 9v1c0 .8.4 1.6 1.2 2.3l.3.3V19h8v-1.4l.3-.3c.8-.7 1.2-1.5 1.2-2.3v-1h-11z" />
        }
        @case ('can') {
          <path d="M8 2h8l1 2v1.2c.6.5 1 1.2 1 2V19c0 .8-.4 1.5-1 2l-1 1H8l-1-1c-.6-.5-1-1.2-1-2V7.2c0-.8.4-1.5 1-2V4l1-2zm.5 5C8.2 7 8 7.2 8 7.5v11c0 .3.2.5.5.5h7c.3 0 .5-.2.5-.5v-11c0-.3-.2-.5-.5-.5h-7zM10 10h4v6h-4v-6z" />
        }
        @case ('bottle') {
          <path d="M10 2h4v1h-.5v4.2c2 .9 3.5 2.9 3.5 5.3V21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-8.5c0-2.4 1.5-4.4 3.5-5.3V3H10V2zm2.5 6.6-.6.3C10.2 9.6 9 11 9 12.5V20h6v-7.5c0-1.5-1.2-2.9-2.9-3.6l-.6-.3zM9 14h6v4H9v-4z" />
        }
        @case ('liquid') {
          <path d="M12 2.5l.8.9C15.4 6.3 18 9.9 18 13.5a6 6 0 0 1-12 0c0-3.6 2.6-7.2 5.2-10.1l.8-.9zm0 3C10 8 8 10.9 8 13.5a4 4 0 0 0 8 0c0-2.6-2-5.5-4-8zm-2.5 8h2a1.5 1.5 0 0 0 1.5 1.5v2a3.5 3.5 0 0 1-3.5-3.5z" />
        }
        @case ('weight') {
          <path d="M12 3a3 3 0 0 1 2.8 4H18l3 13H3L6 7h3.2A3 3 0 0 1 12 3zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM7.6 9l-2.1 9h13l-2.1-9H7.6zm2.4 2h4v2h-1v3h-2v-3h-1v-2z" />
        }
        @case ('box') {
          <path d="M3 7l9-4 9 4v10l-9 4-9-4V7zm9 1.8L5 5.9v.1l7 3.1 7-3.1v-.1l-7 2.9zM5 8.2v7.5l6 2.7v-7.5L5 8.2zm8 10.2l6-2.7V8.2l-6 2.7v7.5z" />
        }
        @case ('pack') {
          <path d="M4 6h16v14H4V6zm2 2v10h12V8H6zm1-5h10v2H7V3zm2 7h6v2H9v-2z" />
        }
        @default {
          <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9zm2-.8 7 7 6.2-6.2-7-7H5v6.2zM8.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--accent-soft);
      color: var(--accent);
    }
    svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }
  `,
})
export class ProductIcon {
  readonly name = input.required<string>();
  readonly unit = input.required<Unit>();

  protected readonly kind = computed<IconKind>(() => {
    const hit = NAME_HINTS.find(([re]) => re.test(this.name()));
    return hit ? hit[1] : BY_UNIT[this.unit()];
  });
}
