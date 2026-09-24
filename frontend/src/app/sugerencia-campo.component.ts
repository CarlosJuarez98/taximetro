import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Campo de texto con lista de sugerencias (clientes / destinos previos). */
@Component({
  selector: 'app-sugerencia-campo',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SugerenciaCampoComponent),
      multi: true,
    },
  ],
  template: `
    <div class="sug" [class.open]="abierto && filtradas.length">
      <input
        [type]="type"
        [name]="name"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [attr.autocomplete]="autocomplete"
        [attr.inputmode]="inputmode || null"
        [value]="valor"
        (input)="onInput($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
      />
      @if (abierto && filtradas.length) {
        <ul class="lista" role="listbox">
          @for (s of filtradas; track s) {
            <li>
              <button type="button" class="opt" (mousedown)="elegir(s, $event)">{{ s }}</button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }
      .sug {
        position: relative;
        width: 100%;
      }
      .lista {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 4px);
        z-index: 40;
        margin: 0;
        padding: 0.25rem;
        list-style: none;
        max-height: 10.5rem;
        overflow: auto;
        border-radius: 0.55rem;
        border: 1px solid color-mix(in srgb, var(--rojo) 35%, var(--linea));
        background: #161218;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
      }
      .opt {
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        color: var(--texto);
        padding: 0.45rem 0.55rem;
        border-radius: 0.4rem;
        font: inherit;
        font-weight: 650;
        font-size: 0.88rem;
        min-height: 2.1rem;
      }
      .opt:hover,
      .opt:focus {
        background: color-mix(in srgb, var(--rojo) 22%, transparent);
        outline: none;
      }
    `,
  ],
})
export class SugerenciaCampoComponent implements ControlValueAccessor, OnChanges {
  @Input() sugerencias: string[] = [];
  @Input() placeholder = '';
  @Input() name = '';
  @Input() type = 'text';
  @Input() autocomplete = 'off';
  @Input() inputmode = '';
  @Input() maxVisible = 8;
  @Output() valorChange = new EventEmitter<string>();

  valor = '';
  abierto = false;
  disabled = false;
  filtradas: string[] = [];

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sugerencias']) {
      this.refiltrar();
    }
  }

  writeValue(v: string | null): void {
    this.valor = v || '';
    this.refiltrar();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.valor = v;
    this.onChange(v);
    this.valorChange.emit(v);
    this.abierto = true;
    this.refiltrar();
  }

  onFocus(): void {
    this.abierto = true;
    this.refiltrar();
  }

  onBlur(): void {
    this.onTouched();
    // delay para permitir mousedown en opción
    setTimeout(() => (this.abierto = false), 120);
  }

  elegir(s: string, ev: Event): void {
    ev.preventDefault();
    this.valor = s;
    this.onChange(s);
    this.valorChange.emit(s);
    this.abierto = false;
  }

  @HostListener('keydown.escape')
  onEsc(): void {
    this.abierto = false;
  }

  private refiltrar(): void {
    const q = this.valor.trim().toLowerCase();
    const base = this.sugerencias || [];
    const match = q
      ? base.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      : base;
    this.filtradas = match.slice(0, this.maxVisible);
  }
}
