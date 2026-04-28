import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterModule, ToastModule, ConfirmDialogModule],
    template: `
        <p-toast position="top-right" />
        <p-confirmDialog [style]="{ width: '28rem' }" />
        <router-outlet></router-outlet>
    `
})
export class AppComponent {
}
