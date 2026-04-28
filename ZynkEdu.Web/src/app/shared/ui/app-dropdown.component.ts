import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectModule } from 'primeng/select';

@Component({
    selector: 'app-dropdown',
    standalone: true,
    imports: [CommonModule, FormsModule, SelectModule],
    templateUrl: './app-dropdown.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => AppDropdownComponent),
            multi: true
        }
    ]
})
export class AppDropdownComponent implements ControlValueAccessor {
    @Input() options: unknown[] = [];
    @Input() optionLabel = 'label';
    @Input() optionValue?: string;
    @Input() placeholder = 'Select an option';
    @Input() filter = true;
    @Input() filterBy = 'label';
    @Input() filterPlaceholder = 'Search';
    @Input() showClear = false;
    @Input() disabled = false;
    @Input() appendTo: 'body' | HTMLElement | string = 'body';
    @Input() styleClass = 'w-full';
    @Input() panelStyleClass = '';
    @Input() inputId = '';
    @Input() dataKey = '';
    @Output() opened = new EventEmitter<void>();

    value: unknown = null;

    private onChange: (value: unknown) => void = () => void 0;
    private onTouched: () => void = () => void 0;

    writeValue(value: unknown): void {
        this.value = value;
    }

    registerOnChange(fn: (value: unknown) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }

    handleChange(value: unknown): void {
        this.value = value;
        this.onChange(value);
    }

    handleShow(): void {
        this.opened.emit();
    }

    markTouched(): void {
        this.onTouched();
    }
}
