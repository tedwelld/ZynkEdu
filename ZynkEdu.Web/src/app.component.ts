import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { setLogoDataUrl } from './app/shared/report/report-pdf';

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
export class AppComponent implements OnInit {
    ngOnInit(): void {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="c"><rect width="64" height="64" rx="14"/></clipPath>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <rect width="64" height="36" rx="14" fill="url(#s)"/>
  <g clip-path="url(#c)">
    <path d="M17 26 Q32 21 47 26 L59 68 L5 68 Z" fill="white" fill-opacity="0.88"/>
    <path d="M17 30 L2 46 L7 57 L20 40 Z" fill="white" fill-opacity="0.82"/>
    <path d="M47 30 L62 46 L57 57 L44 40 Z" fill="white" fill-opacity="0.82"/>
    <path d="M32 5 L56 17 L32 25 L8 17 Z" fill="white"/>
    <circle cx="32" cy="12" r="2.5" fill="white" fill-opacity="0.4"/>
    <line x1="56" y1="17" x2="57" y2="29" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
    <circle cx="57" cy="30" r="2.5" fill="white" opacity="0.8"/>
  </g>
</svg>`;
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const img = new Image();
        img.onload = () => {
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, size, size);
                setLogoDataUrl(canvas.toDataURL('image/png'));
            }
            URL.revokeObjectURL(url);
        };
        img.onerror = () => { URL.revokeObjectURL(url); };
        img.src = url;
    }
}
