/** Keep the owner's original symbol; readable lettering on the app's light surfaces. */
export default function NativeBrand() {
  return (
    <span className="viso-app-brand">
      <span className="viso-app-brand-symbol" aria-hidden="true">
        <img src="/brand/viso-logo.png" alt="" />
      </span>
      <span>VISO</span>
    </span>
  );
}
