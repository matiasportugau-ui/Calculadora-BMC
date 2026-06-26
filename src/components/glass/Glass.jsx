/**
 * Thin wrapper for .glass CSS primitive.
 * @param {object} props
 * @param {keyof JSX.IntrinsicElements} [props.as='div']
 * @param {boolean} [props.refract]
 * @param {boolean} [props.interactive]
 */
export default function Glass({
  as: Tag = "div",
  className = "",
  refract = false,
  interactive = false,
  style,
  children,
  ...rest
}) {
  const cls = [
    "glass",
    refract ? "glass-refract" : "",
    interactive ? "glass-interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={cls} style={style} {...rest}>
      {children}
    </Tag>
  );
}
