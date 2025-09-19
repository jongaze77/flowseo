import RegistrationForm from '../../components/RegistrationForm';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to FlowSEO</h1>
          <p className="text-gray-600">Create your account and set up your team to get started</p>
        </div>
        <RegistrationForm />
      </div>
    </div>
  );
}