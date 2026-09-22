"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";
export class ModuleBoundary extends Component<
  { children: ReactNode; name: string },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development")
      console.warn(
        `[Тогтмол/${this.props.name}]`,
        error.name,
        info.componentStack,
      );
  }
  render() {
    if (this.state.failed)
      return (
        <section className="card module-error" role="alert">
          <h2>{this.props.name} түр ажиллахгүй байна</h2>
          <p>Энэ хэсгийг дахин нээж болно. Хадгалсан өгөгдлийг устгаагүй.</p>
          <button
            className="button"
            onClick={() =>
              this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))
            }
          >
            Дахин нээх
          </button>
        </section>
      );
    return (
      <div className="module-content" key={this.state.attempt}>
        {this.props.children}
      </div>
    );
  }
}
