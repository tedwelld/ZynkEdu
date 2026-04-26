import { TestBed } from '@angular/core/testing';
import { MetricCardComponent } from './metric-card.component';

describe('MetricCardComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MetricCardComponent]
        }).compileComponents();
    });

    it('renders the provided metric details', () => {
        const fixture = TestBed.createComponent(MetricCardComponent);

        fixture.componentRef.setInput('label', 'Total Students');
        fixture.componentRef.setInput('value', '128');
        fixture.componentRef.setInput('delta', 'Up 12%');
        fixture.componentRef.setInput('hint', 'This week');
        fixture.componentRef.setInput('icon', 'pi pi-users');
        fixture.componentRef.setInput('tone', 'green');
        fixture.componentRef.setInput('direction', 'up');
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain('Total Students');
        expect(text).toContain('128');
        expect(text).toContain('Up 12%');
        expect(text).toContain('This week');
    });
});
