// The Daydle mark, cut out of the brand artwork as an alpha mask (public/daydle-*.png) and
// filled with the theme's accent gradient, so one asset serves both dark and light mode.
const MARKS = {
  wordmark: { src: "/daydle-wordmark.png", ratio: "640 / 522" }, // DAYDLE + calendar
  full: { src: "/daydle-mark.png", ratio: "640 / 624" }, // with rule line and tagline
};

export function Logo({ variant = "wordmark", className = "" }: { variant?: keyof typeof MARKS; className?: string }) {
  const { src, ratio } = MARKS[variant];
  return (
    <div
      role="img"
      aria-label="Daydle"
      className={`bg-gradient-to-r from-xp-a to-xp-b ${className}`}
      style={{
        aspectRatio: ratio,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
