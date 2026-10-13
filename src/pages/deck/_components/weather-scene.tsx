import { useId } from "react";
import { rainyWeather } from "../_lib/weather-presentation";
export default function WeatherScene({
  code,
  isDay,
  active,
}: {
  code: number;
  isDay: boolean;
  active: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rain = rainyWeather(code);
  const snow = [71, 73, 75, 77, 85, 86].includes(code);
  const cloudy = code >= 2;
  const sky = !isDay
    ? ["#192d54", "#2a486a", "#375d70"]
    : rain
      ? ["#92b4c3", "#83a7b8", "#80c1bd"]
      : cloudy
        ? ["#93bac9", "#99c0cc", "#9ecacb"]
        : ["#459fe0", "#78c7e4", "#b0dedd"];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(180deg,${sky[0]},${sky[1]} 50%,${sky[2]})`,
      }}
    >
      <svg
        className="absolute inset-x-0 top-0 h-[min(80vh,640px)] w-full opacity-75"
        viewBox="0 0 700 640"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <filter id={`${id}-cloud`}>
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <linearGradient id={`${id}-water`} x2="0" y2="1">
            <stop stopColor="#83bcc2" />
            <stop offset="1" stopColor="#417e94" />
          </linearGradient>
        </defs>
        {cloudy ? (
          <g fill="white" opacity=".17" filter={`url(#${id}-cloud)`}>
            <ellipse cx="90" cy="80" rx="200" ry="72" />
            <ellipse cx="400" cy="170" rx="140" ry="62" />
            <ellipse cx="590" cy="65" rx="200" ry="72" />
          </g>
        ) : (
          <circle
            cx="535"
            cy="110"
            r={isDay ? 45 : 30}
            fill={isDay ? "#ffeaa0" : "#e4eaf2"}
            opacity=".8"
          />
        )}
        <g className="portrait:-translate-y-[200px]">
          <path
            d="M0 442 Q90 390 175 428 Q270 370 360 415 Q500 372 700 430 L700 560 L0 560Z"
            fill="#436b80"
            opacity=".45"
          />
          <path
            d="M0 470 Q130 425 230 456 Q430 410 700 460 L700 580 L0 580Z"
            fill="#527f8d"
            opacity=".6"
          />
          <path d="M0 490 H700 V600 H0Z" fill={`url(#${id}-water)`} />
          <g stroke="#c9e0dc" opacity=".28">
            {[514, 530, 545, 565, 581].map((y, i) => (
              <path key={y} d={`M${20 + i * 37} ${y} h${590 - i * 22}`} />
            ))}
          </g>
          <path
            d="M0 588 Q200 564 390 589 Q570 566 700 593 V640H0Z"
            fill="#597955"
          />
          <path d="M0 621 Q260 596 450 620 T700 615 V640 H0Z" fill="#688552" />
          <g transform="translate(472 453)">
            <ellipse
              cx="0"
              cy="137"
              rx="31"
              ry="6"
              fill="#324c43"
              opacity=".3"
            />
            <path
              d="M-12 75 L-7 131 H1 L3 72 M10 74 L18 131 H27 L23 69"
              fill="#566162"
            />
            <path d="M-15 18 Q4 2 19 19 L25 77 H-19Z" fill="#cee5df" />
            <path
              d="M-13 22 L-25 56 L-21 70 L-17 69 L-16 54 L-4 28"
              fill="#cfdfd6"
            />
            <path
              d="M13 20 L29 43 L36 22"
              fill="none"
              stroke="#c4ded8"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <ellipse cx="1" cy="0" rx="11" ry="14" fill="#d8b7a1" />
            <path d="M-10 -6 Q0 -21 12 -3 L11 17 Q-3 16-10 4Z" fill="#344553" />
            {rain || snow ? (
              <g>
                <path
                  d="M36 -43 V29 q0 9-8 8"
                  fill="none"
                  stroke="#727b87"
                  strokeWidth="3"
                />
                <path
                  d="M-11 -36 Q28 -87 77 -29 Q58 -44 44 -28 Q23 -44 8 -29Z"
                  fill="#333a67"
                />
                <path d="M8 -29 Q25 -75 36 -62 Q50 -59 44 -28" fill="#4b558b" />
                <path d="M36 -62 L34 -69" stroke="#5b607f" strokeWidth="2" />
              </g>
            ) : null}
          </g>
        </g>
      </svg>
      {rain && (
        <div className="absolute inset-0 opacity-35">
          {Array.from({ length: 35 }, (_, i) => (
            <i
              key={i}
              className="absolute top-[-20%] h-14 w-px bg-gradient-to-b from-transparent to-white motion-reduce:opacity-0"
              style={{
                left: `${(i * 29) % 101}%`,
                animation: `viso-weather-rain ${1.4 + (i % 6) * 0.16}s linear infinite`,
                animationDelay: `-${i * 0.3}s`,
                animationPlayState: active ? "running" : "paused",
              }}
            />
          ))}
        </div>
      )}
      {snow && (
        <div className="absolute inset-0 opacity-45">
          {Array.from({ length: 24 }, (_, i) => (
            <i
              key={i}
              className="absolute top-[-10%] size-1 rounded-full bg-white motion-reduce:opacity-0"
              style={{
                left: `${(i * 37) % 101}%`,
                animation: `viso-weather-rain ${5 + (i % 4)}s linear infinite`,
                animationDelay: `-${i * 0.4}s`,
                animationPlayState: active ? "running" : "paused",
              }}
            />
          ))}
        </div>
      )}
      <style>{`@keyframes viso-weather-rain { from { transform:translateY(-10vh) rotate(12deg); } to { transform:translateY(120vh) rotate(12deg); } }`}</style>
    </div>
  );
}
