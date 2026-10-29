import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { RoleSelect } from './pages/auth/RoleSelect';
import { NotFound } from './pages/NotFound';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { PatientDashboard } from './pages/patient/Dashboard';
import { AIConsultation } from './pages/patient/AIConsultation';
import { SearchDoctors } from './pages/patient/SearchDoctors';
import { DoctorProfile } from './pages/patient/DoctorProfile';
import { BookAppointment } from './pages/patient/BookAppointment';
import { Appointments } from './pages/patient/Appointments';
import { MedicalRecords } from './pages/patient/MedicalRecords';
import { Telemedicine } from './pages/patient/Telemedicine';
import { Pharmacy } from './pages/patient/Pharmacy';
import { LabTests } from './pages/patient/LabTests';
import { LabResults } from './pages/patient/LabResults';
import { BedBooking } from './pages/patient/BedBooking';
import { HospitalAdminDashboard } from './pages/hospital-admin/Dashboard';
import { HospitalAdminDoctors } from './pages/hospital-admin/Doctors';
import { HospitalAdminApprovals } from './pages/hospital-admin/Approvals';
import { HospitalAdminDepartments } from './pages/hospital-admin/Departments';
import { HospitalAdminAppointments } from './pages/hospital-admin/Appointments';
import { HospitalAdminBeds } from './pages/hospital-admin/Beds';
import { DoctorDashboard } from './pages/doctor/Dashboard';
import { DoctorSchedule } from './pages/doctor/Schedule';
import { DoctorPatients } from './pages/doctor/Patients';
import { DoctorPatientRecord } from './pages/doctor/PatientRecord';
import { LabAdminDashboard } from './pages/lab-admin/Dashboard';
import { LabAdminCatalog } from './pages/lab-admin/Catalog';
import { LabAdminBookings } from './pages/lab-admin/Bookings';
import { PharmacyAdminDashboard } from './pages/pharmacy-admin/Dashboard';
import { PharmacyAdminCatalog } from './pages/pharmacy-admin/Catalog';
import { PharmacyAdminOrders } from './pages/pharmacy-admin/Orders';
import { SystemAdminDashboard } from './pages/system-admin/Dashboard';
import { SystemAdminApprovals } from './pages/system-admin/Approvals';
import { SystemAdminUsers } from './pages/system-admin/Users';
import { SystemAdminSettings } from './pages/system-admin/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/role-select" element={<RoleSelect />} />

            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="/patient/dashboard" element={<ProtectedRoute roles={['patient']}><PatientDashboard /></ProtectedRoute>} />
            <Route path="/patient/ai-consultation" element={<ProtectedRoute roles={['patient']}><AIConsultation /></ProtectedRoute>} />
            <Route path="/patient/search-doctors" element={<ProtectedRoute roles={['patient']}><SearchDoctors /></ProtectedRoute>} />
            <Route path="/patient/doctors/:id" element={<ProtectedRoute roles={['patient']}><DoctorProfile /></ProtectedRoute>} />
            <Route path="/patient/book-appointment" element={<ProtectedRoute roles={['patient']}><BookAppointment /></ProtectedRoute>} />
            <Route path="/patient/appointments" element={<ProtectedRoute roles={['patient']}><Appointments /></ProtectedRoute>} />
            <Route path="/patient/medical-records" element={<ProtectedRoute roles={['patient']}><MedicalRecords /></ProtectedRoute>} />
            <Route path="/patient/telemedicine" element={<ProtectedRoute roles={['patient', 'doctor']}><Telemedicine /></ProtectedRoute>} />
            <Route path="/patient/pharmacy" element={<ProtectedRoute roles={['patient']}><Pharmacy /></ProtectedRoute>} />
            <Route path="/patient/lab-tests" element={<ProtectedRoute roles={['patient']}><LabTests /></ProtectedRoute>} />
            <Route path="/patient/lab-results" element={<ProtectedRoute roles={['patient']}><LabResults /></ProtectedRoute>} />
            <Route path="/patient/bed-booking" element={<ProtectedRoute roles={['patient']}><BedBooking /></ProtectedRoute>} />

            <Route path="/doctor/dashboard" element={<ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
            <Route path="/doctor/schedule" element={<ProtectedRoute roles={['doctor']}><DoctorSchedule /></ProtectedRoute>} />
            <Route path="/doctor/patients" element={<ProtectedRoute roles={['doctor']}><DoctorPatients /></ProtectedRoute>} />
            <Route path="/doctor/patient-record" element={<ProtectedRoute roles={['doctor']}><DoctorPatientRecord /></ProtectedRoute>} />

            <Route path="/hospital-admin/dashboard" element={<ProtectedRoute roles={['hospital']}><HospitalAdminDashboard /></ProtectedRoute>} />
            <Route path="/hospital-admin/doctors" element={<ProtectedRoute roles={['hospital']}><HospitalAdminDoctors /></ProtectedRoute>} />
            <Route path="/hospital-admin/approvals" element={<ProtectedRoute roles={['hospital']}><HospitalAdminApprovals /></ProtectedRoute>} />
            <Route path="/hospital-admin/departments" element={<ProtectedRoute roles={['hospital']}><HospitalAdminDepartments /></ProtectedRoute>} />
            <Route path="/hospital-admin/appointments" element={<ProtectedRoute roles={['hospital']}><HospitalAdminAppointments /></ProtectedRoute>} />
            <Route path="/hospital-admin/beds" element={<ProtectedRoute roles={['hospital']}><HospitalAdminBeds /></ProtectedRoute>} />

            <Route path="/lab-admin/dashboard" element={<ProtectedRoute roles={['lab']}><LabAdminDashboard /></ProtectedRoute>} />
            <Route path="/lab-admin/catalog" element={<ProtectedRoute roles={['lab']}><LabAdminCatalog /></ProtectedRoute>} />
            <Route path="/lab-admin/bookings" element={<ProtectedRoute roles={['lab']}><LabAdminBookings /></ProtectedRoute>} />

            <Route path="/pharmacy-admin/dashboard" element={<ProtectedRoute roles={['pharmacy']}><PharmacyAdminDashboard /></ProtectedRoute>} />
            <Route path="/pharmacy-admin/catalog" element={<ProtectedRoute roles={['pharmacy']}><PharmacyAdminCatalog /></ProtectedRoute>} />
            <Route path="/pharmacy-admin/orders" element={<ProtectedRoute roles={['pharmacy']}><PharmacyAdminOrders /></ProtectedRoute>} />

            <Route path="/system-admin/dashboard" element={<ProtectedRoute roles={['admin']}><SystemAdminDashboard /></ProtectedRoute>} />
            <Route path="/system-admin/approvals" element={<ProtectedRoute roles={['admin']}><SystemAdminApprovals /></ProtectedRoute>} />
            <Route path="/system-admin/users" element={<ProtectedRoute roles={['admin']}><SystemAdminUsers /></ProtectedRoute>} />
            <Route path="/system-admin/settings" element={<ProtectedRoute roles={['admin']}><SystemAdminSettings /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
