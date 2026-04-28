import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { TeacherProfile } from './profile';
import { UserResponse } from '../../core/api/api.models';

describe('TeacherProfile', () => {
    const teacher: UserResponse = {
        id: 5,
        username: 'jane.teacher',
        displayName: 'Jane Teacher',
        role: 'Teacher',
        schoolId: 1,
        createdAt: new Date().toISOString(),
        isActive: true
    };

    let apiSpy: jasmine.SpyObj<ApiService>;
    let authSpy: jasmine.SpyObj<AuthService>;

    beforeEach(async () => {
        apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['getTeachers', 'getAssignmentsByTeacher', 'updateTeacher', 'getAdmins', 'updateAdmin']);
        authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['role', 'userId', 'schoolId', 'displayName', 'updateDisplayName']);
        authSpy.role.and.returnValue('Teacher');
        authSpy.userId.and.returnValue(5);
        authSpy.schoolId.and.returnValue(1);
        authSpy.displayName.and.returnValue('Jane Teacher');
        apiSpy.getTeachers.and.returnValue(of([teacher]));
        apiSpy.getAssignmentsByTeacher.and.returnValue(of([]));
        apiSpy.updateTeacher.and.returnValue(of({ ...teacher, displayName: 'Jane Updated' }));

        await TestBed.configureTestingModule({
            imports: [TeacherProfile, RouterTestingModule],
            providers: [
                { provide: ApiService, useValue: apiSpy },
                { provide: AuthService, useValue: authSpy }
            ]
        }).compileComponents();
    });

    it('saves the profile and refreshes the session display name', () => {
        const fixture = TestBed.createComponent(TeacherProfile);
        const component = fixture.componentInstance;
        component.profile = teacher;
        component.draft = { displayName: 'Jane Updated', password: 'Secret123!' };

        component.saveProfile();

        expect(apiSpy.updateTeacher).toHaveBeenCalledWith(5, {
            displayName: 'Jane Updated',
            password: 'Secret123!',
            isActive: true
        });
        expect(authSpy.updateDisplayName).toHaveBeenCalledWith('Jane Updated');
    });
});
