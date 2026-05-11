\subsection{Hipotesis 3: Linea defensiva alta vs riesgo}

\subsubsection{Hipotesis}

\textit{
Los equipos que utilizan lineas defensivas altas tienden a generar mas oportunidades ofensivas, pero tambien presentan una mayor probabilidad de recibir goles en comparacion con equipos que emplean lineas defensivas bajas.
}

% =====================================================

\subsubsection{Datos y metodo}

\begin{itemize}

\item Fuente: \texttt{three_sixty_freeze_frame.parquet}, \texttt{events_fact.parquet} y \texttt{matches_fact.parquet}.

\item Linea defensiva: percentil 0.90 de \texttt{x} de defensores (\texttt{teammate == False}) por evento.

\item Goles: filtro de eventos de tiro con \texttt{shot_outcome == "Goal"}.

\item Riesgo: comparacion con \texttt{goles_total} del partido como indicador global.

\end{itemize}

% =====================================================

\subsubsection{Procedimiento}

\begin{enumerate}

\item Integracion de 360 con eventos por \texttt{event_id}.

\item Identificacion de defensores con \texttt{teammate == False}.

\item Calculo de la linea defensiva por evento (percentil 0.90 de \texttt{x}).

\item Filtrado de goles usando \texttt{shot_outcome == "Goal"}.

\item Construccion de graficos: campo con linea defensiva, franjas por linea, nube de puntos en goles y heatmap por cuadrantes.

\end{enumerate}

% =====================================================

\subsubsection{Construccion de variables}

\paragraph{Tabla 1: Columnas usadas}

\begin{table}[H]
\centering
\begin{tabular}{|l|l|l|}
\hline
Columna & Uso & Operacion \\ \hline
event_id & llave del evento & merge 360 + eventos \\ \hline
match_id & llave del partido & join con goles_total \\ \hline
x, y & posicion jugador & percentil y graficos \\ \hline
teammate & identifica defensores & filtro teammate == False \\ \hline
event_type_name & tipo de evento & filtro Shot \\ \hline
shot_outcome & resultado del tiro & filtro Goal \\ \hline
home_score, away_score & goles partido & goles_total = suma \\ \hline
\end{tabular}
\caption{Columnas y operaciones usadas para Hipotesis 3.}
\end{table}

\textbf{Interpretacion:}
Se combinan datos de posicion defensiva (360) con resultados del evento (Goal) para observar donde estaban los defensores cuando ocurre un gol.

% =====================================================

\subsubsection{Graficos}

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h3_linea_campo.png}
\caption{Linea defensiva estimada en un evento de ejemplo.}
\end{figure}

\textbf{Interpretacion:}
La linea defensiva se aproxima con el percentil alto de \texttt{x} de los defensores y sirve como referencia de altura.

% -----------------------------------------------------

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h3_bandas_goles_pct.png}
\caption{Porcentaje de goles por franja de linea defensiva.}
\end{figure}

\textbf{Interpretacion:}
Permite comparar que franjas de linea defensiva concentran mayor porcentaje de goles.

% -----------------------------------------------------

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h3_defensa_goals_scatter.png}
\caption{Nube de puntos de defensores en eventos de gol.}
\end{figure}

\textbf{Interpretacion:}
Muestra la posicion de la defensa en el instante del gol, permitiendo observar patrones espaciales recurrentes.

% -----------------------------------------------------

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h3_goles_cuadrantes_5m.png}
\caption{Heatmap de porcentaje de goles por cuadrantes de 5m.}
\end{figure}

\textbf{Interpretacion:}
Los cuadrantes con mayor porcentaje indican zonas donde se registran mas goles y donde la defensa puede estar mas expuesta.

% -----------------------------------------------------

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h3_linea_vs_goles.png}
\caption{Relacion entre altura de linea defensiva y goles totales.}
\end{figure}

\textbf{Interpretacion:}
La relacion lineal es debil, lo que sugiere que la altura por si sola no explica la cantidad total de goles.

% =====================================================

\subsubsection{Conclusion}

Con el filtro de goles reales, el patron espacial es mas claro en los mapas, pero la correlacion global entre altura de linea y goles sigue siendo baja. La hipotesis no se confirma de forma contundente; se recomienda integrar volumen de tiros o xG para un contraste mas robusto.
