function hasExtension(specifier) {
  return /\.[cm]?[jt]sx?$|\.json$|\.css$/.test(specifier);
}

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !hasExtension(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}
