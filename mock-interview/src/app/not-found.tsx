import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-sm text-primary">404</p>
        <h1 className="mt-2 font-serif text-4xl text-navy">This page is not available</h1>
        <p className="mt-3 text-slate-600">The interview or page you requested could not be found.</p>
        <div className="mt-6">
          <ButtonLink href="/dashboard">Back to dashboard</ButtonLink>
        </div>
      </div>
    </div>
  );
}
