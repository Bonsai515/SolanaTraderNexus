// Simple placeholder for class-variance-authority

export interface VariantProps<T> {
  [key: string]: any;
}

export function cva(base: string, config: any = {}) {
  return function(props: any = {}) {
    const classes = [base];
    
    if (config.variants) {
      for (const variant in config.variants) {
        if (props[variant] && config.variants[variant][props[variant]]) {
          classes.push(config.variants[variant][props[variant]]);
        }
      }
    }
    
    return classes.join(' ');
  };
}