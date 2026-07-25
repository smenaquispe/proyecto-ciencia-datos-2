import numpy as np


def fcm(X: np.ndarray, c: int = 4, m: float = 2.0, max_iter: int = 150, eps: float = 1e-6):
    """Fuzzy C-Means — returns U (n×c membership) and cluster centers (c×features)."""
    n = X.shape[0]
    rng = np.random.default_rng(42)
    U = rng.dirichlet(np.ones(c), size=n)
    for _ in range(max_iter):
        Um = U.T ** m
        centers = (Um @ X) / Um.sum(axis=1, keepdims=True)
        dists = np.linalg.norm(X[:, None, :] - centers[None], axis=2)
        dists = np.maximum(dists, 1e-10)
        inv = dists ** (-2.0 / (m - 1))
        U_new = inv / inv.sum(axis=1, keepdims=True)
        if np.max(np.abs(U_new - U)) < eps:
            break
        U = U_new
    return U, centers


def pca2(X: np.ndarray) -> np.ndarray:
    """Manual PCA to 2D (symmetric eigh, no sklearn needed)."""
    Xc = X - X.mean(axis=0)
    cov = Xc.T @ Xc / max(len(Xc) - 1, 1)
    _, vecs = np.linalg.eigh(cov)
    return Xc @ vecs[:, -2:][:, ::-1]


def pca3(X: np.ndarray) -> np.ndarray:
    """Manual PCA to 3D — último eje = profundidad para vista 3D."""
    Xc = X - X.mean(axis=0)
    cov = Xc.T @ Xc / max(len(Xc) - 1, 1)
    _, vecs = np.linalg.eigh(cov)
    return Xc @ vecs[:, -3:][:, ::-1]
