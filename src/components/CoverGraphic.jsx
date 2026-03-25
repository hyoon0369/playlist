export function CoverGraphic() {
  const padding = 20;
  const gridSize = 100;
  const radius = 100;

  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <rect width="240" height="240" fill="#E8E6DD" />

      <path
        d={`M ${padding} ${padding} L ${padding + radius} ${padding} A ${radius} ${radius} 0 0 1 ${padding} ${padding + radius} Z`}
        fill="#C95652"
      />

      <path
        d={`M ${padding + gridSize} ${padding} L ${padding + gridSize + radius} ${padding} A ${radius} ${radius} 0 0 1 ${padding + gridSize} ${padding + radius} Z`}
        fill="#D4A84F"
      />

      <path
        d={`M ${padding} ${padding + gridSize} L ${padding + radius} ${padding + gridSize} A ${radius} ${radius} 0 0 1 ${padding} ${padding + gridSize + radius} Z`}
        fill="#C95652"
      />

      <path
        d={`M ${padding + gridSize} ${padding + gridSize} L ${padding + gridSize + radius} ${padding + gridSize} A ${radius} ${radius} 0 0 1 ${padding + gridSize} ${padding + gridSize + radius} Z`}
        fill="#C95652"
      />
    </svg>
  );
}
