import { Component, Input } from '@angular/core';

let _id = 0;

@Component({
    selector: 'zynkedu-logo',
    standalone: true,
    template: `
        <svg
            [attr.width]="size"
            [attr.height]="size"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="ZynkEdu"
            role="img"
        >
            <defs>
                <linearGradient [attr.id]="gId" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#2563eb"/>
                    <stop offset="100%" stop-color="#7c3aed"/>
                </linearGradient>
                <linearGradient [attr.id]="sId" x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.2"/>
                    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                </linearGradient>
                <clipPath [attr.id]="cId">
                    <rect width="64" height="64" rx="14"/>
                </clipPath>
            </defs>

            <!-- Gradient background -->
            <rect width="64" height="64" rx="14" [attr.fill]="'url(#' + gId + ')'"/>
            <!-- Top-half shine -->
            <rect width="64" height="36" rx="14" [attr.fill]="'url(#' + sId + ')'"/>

            <!-- Graduate figure — clipped to the rounded square -->
            <g [attr.clip-path]="'url(#' + cId + ')'">
                <!-- Gown body: trapezoidal with curved neckline, drawn first so cap sits on top -->
                <path d="M17 26 Q32 21 47 26 L59 68 L5 68 Z" fill="white" fill-opacity="0.88"/>
                <!-- Left wide academic sleeve -->
                <path d="M17 30 L2 46 L7 57 L20 40 Z" fill="white" fill-opacity="0.82"/>
                <!-- Right wide academic sleeve -->
                <path d="M47 30 L62 46 L57 57 L44 40 Z" fill="white" fill-opacity="0.82"/>
                <!-- Mortarboard board (diamond — top-down view) -->
                <path d="M32 5 L56 17 L32 25 L8 17 Z" fill="white"/>
                <!-- Centre top-button on board -->
                <circle cx="32" cy="12" r="2.5" fill="white" fill-opacity="0.4"/>
                <!-- Tassel string from right corner -->
                <line x1="56" y1="17" x2="57" y2="29" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
                <!-- Tassel bob -->
                <circle cx="57" cy="30" r="2.5" fill="white" opacity="0.8"/>
            </g>
        </svg>
    `
})
export class ZynkEduLogo {
    @Input() size: number | string = 44;

    readonly gId = `ze-g-${++_id}`;
    readonly sId = `ze-s-${++_id}`;
    readonly cId = `ze-c-${++_id}`;
}
