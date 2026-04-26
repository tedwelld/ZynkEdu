import { Component } from '@angular/core';

@Component({
    selector: 'app-footer',
    standalone: true,
    template: `
        <footer class="layout-footer">
            <div class="layout-footer__inner">
                <div class="layout-footer__brand">
                    <span class="layout-footer__title">ZynkEdu</span>
                    <span class="layout-footer__subtitle">School management for admins, teachers, and parents</span>
                </div>

                <div class="layout-footer__socials" aria-label="Social links">
                    <a href="https://www.facebook.com/tedwelld" target="_blank" rel="noreferrer noopener" aria-label="Facebook" class="layout-footer__social">
                        <i class="pi pi-facebook"></i>
                    </a>
                    <a href="https://www.instagram.com/tedwelld/" target="_blank" rel="noreferrer noopener" aria-label="Instagram" class="layout-footer__social">
                        <i class="pi pi-instagram"></i>
                    </a>
                    <a href="https://wa.me/263789276807" target="_blank" rel="noreferrer noopener" aria-label="WhatsApp" class="layout-footer__social layout-footer__social--whatsapp">
                        <i class="pi pi-whatsapp"></i>
                    </a>
                    <a
                        href="https://www.linkedin.com/in/%20tedwell-zwane-b31684391"
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label="LinkedIn"
                        class="layout-footer__social"
                    >
                        <i class="pi pi-linkedin"></i>
                    </a>
                </div>

                <div class="layout-footer__contact">
                    <span>tedwell@outlook.com</span>
                    <span>zwanetedwelldumezweni@gmail.com</span>
                    <span>+263789276807</span>
                </div>
            </div>
        </footer>
    `
})
export class AppFooter {}
