\subsection{Hipotesis 2: Ventaja de local}

\subsubsection{Hipotesis}

    extit{

Los equipos que juegan en condicion de local tienen una mayor probabilidad de obtener resultados positivos en comparacion con los equipos visitantes.
}

% =====================================================

\subsubsection{Datos y metodo}

\begin{itemize}

\item Fuente: \texttt{matches_fact.parquet}.

\item Resultado del partido: clasificacion en \texttt{local}, \texttt{visitante} o \texttt{empate} segun \texttt{home_score} y \texttt{away_score}.

\item Goles promedio por condicion: media de \texttt{home_score} y \texttt{away_score}.

\end{itemize}

% =====================================================

\subsubsection{Procedimiento}

\begin{enumerate}

\item Carga de \texttt{matches_fact.parquet}.

\item Clasificacion del resultado del partido con una funcion condicional.

\item Conteo y porcentaje de resultados por condicion.

\item Calculo de goles promedio por condicion.

\item Visualizacion con barra de porcentajes y boxplot de goles.

\end{enumerate}

% =====================================================

\subsubsection{Construccion de variables}

\paragraph{Tabla 1: Columnas usadas (matches_fact)}

\begin{table}[H]
\centering
\begin{tabular}{|l|l|l|}
\hline
Columna & Uso & Operacion \\ \hline
match_id & llave del partido & mantiene valor original \\ \hline
home_team_id & id local & referencia de equipo \\ \hline
away_team_id & id visitante & referencia de equipo \\ \hline
home_score & goles local & comparacion y media \\ \hline
away_score & goles visitante & comparacion y media \\ \hline
\end{tabular}
\caption{Columnas utilizadas para la hipotesis 2.}
\end{table}

    extbf{Interpretacion:}

Se usan los goles local/visitante para clasificar resultados y calcular promedios por condicion.

% =====================================================

\paragraph{Tabla 2: Conteo de resultados}

\begin{table}[H]
\centering
\begin{tabular}{|l|c|}
\hline
Resultado & Conteo \\ \hline
local & 1565 \\ \hline
visitante & 1102 \\ \hline
empate & 797 \\ \hline
\end{tabular}
\caption{Conteo de resultados por condicion.}
\end{table}

    extbf{Interpretacion:}

Los locales ganan mas partidos que los visitantes, lo que sugiere una ventaja local inicial.

% =====================================================

\paragraph{Tabla 3: Porcentaje de resultados}

\begin{table}[H]
\centering
\begin{tabular}{|l|c|}
\hline
Resultado & Porcentaje \\ \hline
local & 45.178984 \% \\ \hline
visitante & 31.812933 \% \\ \hline
empate & 23.008083 \% \\ \hline
\end{tabular}
\caption{Porcentaje de resultados por condicion.}
\end{table}

    extbf{Interpretacion:}

El local gana cerca de la mitad de los partidos, mientras que el visitante gana cerca de un tercio.

% =====================================================

\paragraph{Tabla 4: Goles promedio por condicion}

\begin{table}[H]
\centering
\begin{tabular}{|l|c|}
\hline
Condicion & Goles promedio \\ \hline
local & 1.596420 \\ \hline
visitante & 1.257217 \\ \hline
\end{tabular}
\caption{Media de goles por condicion.}
\end{table}

    extbf{Interpretacion:}

Los locales anotan mas goles en promedio, lo que refuerza la ventaja de jugar en casa.

% =====================================================

\subsubsection{Graficos}

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h2_resultados_bar.png}
\caption{Distribucion de resultados (local, visitante, empate).}
\end{figure}

    extbf{Interpretacion:}

La barra confirma que la frecuencia de victorias del local supera a las de visitante y empates.

% -----------------------------------------------------

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{figures/h2_goles_boxplot.png}
\caption{Distribucion de goles por condicion.}
\end{figure}

    extbf{Interpretacion:}

El boxplot muestra que la distribucion de goles del local se desplaza hacia valores mas altos.

% =====================================================

\subsubsection{Conclusion}

La evidencia apoya la hipotesis: el local gana con mayor frecuencia y anota mas goles en promedio.
