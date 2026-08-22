import { SolarSitesConfigNotice } from "@/components/dashboard/solar-sites-config-notice";

export default function SolarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-4">
        <SolarSitesConfigNotice />
      </div>
      {children}
    </>
  );
}
