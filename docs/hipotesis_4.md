\subsection{Hipotesis 4: Pases progresivos o verticales}

\subsubsection{Hipotesis}

\textit{
Los equipos que realizan una mayor proporcion de pases progresivos o verticales tienen una mayor capacidad de generar ocasiones de gol y anotar mas goles en comparacion con equipos que priorizan pases horizontales.
}

% =====================================================

\subsubsection{Datos y metodo}

\begin{itemize}

\item Fuente: \texttt{events_fact.parquet} y \texttt{matches_fact.parquet}.

\item Pase vertical: \texttt{dx > 0}, \texttt{angulo <= 20} y \texttt{distancia >= 10}.

\item Agregacion por equipo/partido: proporcion de pases verticales y horizontales.

\item Goles: \texttt{goles_favor} por equipo/partido.

\end{itemize}

% =====================================================

\subsubsection{Procedimiento}

\begin{enumerate}

\item Filtrado de eventos de pase y limpieza de coordenadas.

\item Calculo de \texttt{dx}, \texttt{dy}, distancia y angulo.

\item Clasificacion de pases verticales y horizontales.

\item Agregacion de proporciones por equipo/partido.

\item Union con goles a favor y analisis de correlacion.

\end{enumerate}

% =====================================================

\subsubsection{Construccion de variables}

\paragraph{Tabla 1: Columnas usadas}

\begin{table}[H]
\centering
\begin{tabular}{|l|l|l|}
\hline
Columna & Uso & Operacion \\ \hline
x, y & inicio del pase & base para dx, dy \\ \hline
end_x, end_y & fin del pase & base para dx, dy \\ \hline
dx, dy & avance & end_x - x, end_y - y \\ \hline
distance & distancia & raiz de dx, dy \\ \hline
angle_deg & angulo & arctan2(|dy|, |dx|) \\ \hline
vertical, horizontal & clasificacion & reglas por angulo y avance \\ \hline
\end{tabular}
\caption{Variables derivadas para clasificar pases.}
\end{table}

\textbf{Interpretacion:}
La definicion de pase vertical se basa en avance, angulo y distancia para separar progresivos de conservacion.

% =====================================================

\subsubsection{Resultados clave}

\begin{table}[H]
\centering
\begin{tabular}{|l|c|}
\hline
Relacion & Correlacion \\ \hline
Verticalidad vs goles a favor & -0.219681 \\ \hline
\end{tabular}
\caption{Correlacion entre verticalidad y goles a favor.}
\end{table}

\textbf{Interpretacion:}
La correlacion es debil y negativa con la definicion actual, por lo que no se observa un aumento claro de goles con mas verticalidad.

% =====================================================

\subsubsection{Graficos}

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h4_pases_verticales_campo.png}
\caption{Ejemplos de pases verticales sobre el campo.}
\end{figure}

\textbf{Interpretacion:}
Visualiza trayectorias verticales y su distribucion espacial dentro del campo.

% -----------------------------------------------------

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h4_vertical_scatter.png}
\caption{Relacion entre proporcion de pases verticales y goles a favor.}
\end{figure}

\textbf{Interpretacion:}
No se aprecia una relacion positiva clara entre mayor verticalidad y goles.

% -----------------------------------------------------

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h4_vertical_bins.png}
\caption{Goles promedio por cuartil de verticalidad.}
\end{figure}

\textbf{Interpretacion:}
Los cuartiles superiores no muestran incrementos consistentes en goles promedio.

% =====================================================

\subsubsection{Conclusion}

Con la definicion actual de pase vertical, la hipotesis no se confirma. Se recomienda ajustar el umbral de avance, separar por contexto de partido y considerar xG o zonas de finalizacion para un analisis mas robusto.
