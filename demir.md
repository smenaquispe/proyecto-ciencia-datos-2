#### ORIGINAL RESEARCH

SN Computer Science (2026) 7:
https://doi.org/10.1007/s42979-026-04903-y

```
clustering has become a practical tool for discovering recur-
ring playing styles and supporting comparative tactical
analysis.
This article extends our earlier conference contribution at
ISACE 2025 [ 1 ], which introduced a Deep Embedded Clus-
tering (DEC)-based framework for phase-wise playing style
identification. The journal version broadens that foundation
in three directions that are essential for tactical analysis
in football: (i) explicitly modeling time to capture within-
match dynamics, (ii) improving interpretability of learned
styles, and (iii) quantifying how styles align across game
phases to form coherent system-level identities.
Methodologically, we segment match events into four
possession-driven phases—In-Possession (IP), Out-of-
Possession (OP), Positive Transition (PT), and Negative
Transition (NT)—and train a separate DEC model for each
phase using spatial, network-based, and motif-driven fea-
tures. Unlike classical clustering in a fixed feature space,
DEC jointly learns a cluster-oriented latent representa-
tion and an assignment structure, making it well suited for
```

## Introduction

The increasing availability of detailed, time-stamped foot-
ball event data has made it possible to study team tactics
at scale using data-driven methods. Because these records
encode where and when on-ball actions occur, they enable
analyses that go beyond coarse match aggregates toward
systematic characterization of how teams attack, defend,
and navigate transitions. Within this setting, unsupervised

Ege Demir
demireg20@itu.edu.tr
Nazım Kemal Üre
ure@stanford.edu
Yusuf H. Şahin
sahinyu@itu.edu.tr

(^1) Faculty of Computer and Informatics, Istanbul Technical
University, Istanbul, Turkey
(^2) Stanford Intelligent Systems Laboratory, Stanford University,
Stanford, CA, USA
**Abstract**
We present a phase-aware deep clustering pipeline for discovering interpretable football team playing styles from event
data. Match events are organized into four possession-driven phases (In-Possession, Out-of-Possession, Positive Transi-
tion, and Negative Transition), and each phase is modeled with Deep Embedded Clustering (DEC) to learn cluster-oriented
latent representations from spatiotemporal event-derived features. We extend phase-specific style discovery with four
complementary analyses. First, we incorporate fixed 15-min match windows to study within-match style switching and
tactical adaptation. Second, we test temporal robustness via frozen-model inference by transferring DEC models trained on
first-half matches to second-half data without retraining. Third, we improve interpretability using feature-group ablation,
supervised surrogate modeling, and Shapley Additive Explanations (SHAP) to identify global and local drivers of cluster
assignments. Finally, we quantify inter-phase tactical coherence and combine phase-level styles into holistic archetypes
that capture joint attacking and defensive identities. We benchmark clustering quality against classical baselines and assess
practical relevance through outcome-based analyses, including style matchups and league-wise distributions. Source code
is available at: h t t p s : / / g i t h u b. c o m / e g e c j d e m i r / h o w _ f o o t b a l l _ t e a m s \_ p l a y.
**Keywords** Football analytics · Event data · Unsupervised learning · Deep clustering · Deep embedded clustering ·
Tactical adaptation · Cross-phase coherence · Holistic tactical archetypes · Interpretability
Received: 22 January 2026 / Accepted: 13 March 2026
© The Author(s), under exclusive licence to Springer Nature Singapore Pte Ltd. 2026

# How Do Football Teams Play? An Extended DEC Analysis to Uncover

# Playing Styles

**Ege Demir**^1 ** · Nazım Kemal Üre1,2  · Yusuf H. Şahin**^1

capturing tactical regularities in complex event-derived fea-
ture sets [ 2 ].
Building on this core pipeline, we introduce several new
analyses. First, we incorporate temporal dynamics through
fixed 15-min match windows, enabling the study of within-
match style switching and tactical adaptation. Second, we
evaluate temporal robustness via frozen-model inference:
DEC models trained on first-half matches are applied
directly to second-half data without retraining, providing
a strict test under temporal distribution shift. Third, we
expand interpretability by combining feature group ablation
with supervised surrogate modeling and Shapley Additive
Explanations (SHAP) [ 3 ], yielding both global and local
insights into the drivers of cluster assignments. Finally, we
formalize _inter-phase tactical coherence_ to quantify how
consistently teams preserve their stylistic identity between
holding and transition phases, and we integrate phase-spe-
cific styles to derive holistic multi-phase team archetypes
that jointly summarize attacking and defensive tendencies.
Clustering quality is assessed using the Silhouette
score [ 4 ] and adjusted cluster accuracy metrics _A_ ( _C_ ) 1 and
_A_ ( _C_ ) 2 , which facilitate comparability with established
benchmarks in phase-wise tactical modeling [ 5 ]. Beyond
internal validation, we evaluate practical relevance through
outcome-based analyses, including win-rate matchups and
league-wise style distributions.
The main contributions of this work are as follows:

● Building on our prior DEC-based framework [ 1 ], we
develop an extended multi-phase playing style analysis
pipeline that adds temporal dynamics, robustness test-
ing, interpretability, and cross-phase synthesis.
● We develop a phase-wise tactical modeling pipeline
spanning IP, OP, PT, and NT using domain-informed
features and standardized evaluation metrics.
● We introduce a multi-scale tactical adaptation analysis,
covering both team-level season dynamics and within-
match style changes using fixed 15-min windows.
● We assess temporal robustness via frozen-model infer-
ence by transferring first-half-trained DEC models to
second-half data without retraining.
● We expand interpretability through feature ablation, sur-
rogate modeling, and SHAP-based explanations of clus-
ter assignments.
● We define and quantify inter-phase tactical coherence
and derive holistic tactical archetypes by jointly model-
ing behaviors across all four phases of play.

Overall, this work shows how deep unsupervised learning,
combined with temporally grounded analysis and interpret-
ability-driven modeling, can yield stable and actionable rep-
resentations of football team playing styles.

## Related Work

```
Unsupervised approaches for identifying football play-
ing styles from data have become increasingly common,
spanning both event streams and tracking-based represen-
tations [ 6 ]. In the broader taxonomy of Plakias et al. [ 7 ],
our study primarily falls under playing style recognition and
style effectiveness , where the goal is to discover recurring
tactical patterns and relate them to competitive outcomes.
Relative to work that relies on coarse match aggregates
(e.g., possession percentages or shot counts), event-level
spatiotemporal records enable richer, phase-aware descrip-
tions of how teams build attacks, defend space, and transi-
tion between states of play.
A recurrent theme in this literature is the design of com-
pact yet expressive representations. Network-based views
of team behavior model passing as a directed interaction
graph, from which circulation or centrality summaries can be
derived [ 8 , 9 ]. Complementarily, pass-motif representations
encode short sequences of exchanges (e.g., ABAB, ABCD)
as signatures of combinational structure and build-up com-
plexity [ 10 ]. These representation choices are particularly
well suited for event data, which is widely available and
supports scalable, reproducible analysis. By contrast, track-
ing-based studies can provide formation- and movement-
level detail [ 11 ] but often depend on proprietary datasets,
limiting reproducibility and broad comparative coverage.
Along similar lines, PCA-based clustering has been used to
extract low-dimensional tactical profiles from engineered
features [ 12 – 14 ], though such pipelines still typically apply
clustering in a fixed representation learned independently of
the clustering objective.
Within phase-wise tactical modeling, we include Moffatt
et al. [ 5 ] as a representative example of classical cluster-
ing applied separately across game phases, which aligns
structurally with our multi-phase setup. A key contribution
of their framework is an evaluation protocol based on com-
posite clustering quality metrics, A ( C ) 1 and A ( C ) 2 , formed
by combining standard internal indices: within-cluster sum
of squares ( Iwcss ) [ 15 ], separation index ( Isep ) [ 16 ], dis-
tance-to-centroid ( Idistcc ) [ 17 ], and density ( Idens ) [ 15 ].
Under equal or expert-informed weighting, these metrics
are defined as:
```

#### A ( C ) 1 =

```
Iwcss + Isep + Idistcc + Idens
4
```

#### (1)

```
A ( C ) 2 =
Iwcss +0. 5 · Isep + Idistcc +0. 25 · Idens
2. 75
```

#### . (2)

In addition, we report the Silhouette score [ 4 ], a widely used
internal validity measure that balances intra-cluster cohe-
sion and inter-cluster separation:

_s_ ( _i_ )=

```
b ( i )− a ( i )
max{ a ( i ) ,b ( i )}
```

#### , (3)

where _a_ ( _i_ ) is the mean distance from sample _i_ to other
points in its assigned cluster, and _b_ ( _i_ ) is the smallest mean
distance from _i_ to points in any other cluster. Together, Sil-
houette, _A_ ( _C_ ) 1 , and _A_ ( _C_ ) 2 provide a structured basis for
comparing phase-specific clusterings across methods and
datasets, and we adopt this protocol as a baseline evaluation
reference in our experiments.
A complementary line of work explores football analytics
through alternative AI paradigms. For example, probabilis-
tic verification has been used to study match dynamics in a
transparent simulation-based manner [ 18 ]; broadcast video
has enabled spatial-temporal measurements such as open-
space dynamics without proprietary tracking feeds [ 19 ]; and
recent retrieval-based large language model interfaces aim
to make event data more accessible for querying and narra-
tive exploration [ 20 ]. While these directions are promising,
their objectives differ from unsupervised style discovery via
clustering.
Overall, the literature highlights three recurring chal-
lenges: constructing informative representations from
accessible data, ensuring that discovered styles are interpre-
table and comparable across phases, and connecting styles
to practical relevance. Our work builds on these founda-
tions by combining phase-aware event representations,

```
clustering-driven modeling choices, and outcome-linked
analysis within a unified multi-phase framework.
```

## Methodology

```
Our full pipeline for feature engineering and cluster assign-
ment is given in Fig. 1 , which outlines the complete flow
from raw event data preprocessing to feature extraction,
latent representation learning, and final clustering using
DEC.
```

### Data Collection, Preprocessing, and Feature

### Engineering

```
The dataset used in this study was provided by Massucco
and Pappalardo [ 21 ], comprising over 3 million spatiotem-
porally annotated events from 1826 matches played in the
top-tier football leagues of France, England, Germany, Italy,
and Spain during the 2016–2017 season, including actions
such as passes, duels, shots, and runs. To structure tactical
behavior by possession context, we segment events into four
game phases based on possession dynamics: In-Possession
(IP), Out-of-Possession (OP), Positive Transition (PT), and
Negative Transition (NT). Rather than aggregating at the
team level, each team-match instance is treated as an inde-
pendent sample, yielding 3652 observations per game phase
and enabling robust phase-specific modeling across diverse
match contexts.
Our feature set combines several ideas from prior work.
We use a coarse spatial zoning of the pitch into three
```

**Fig. 1** End-to-end methodology and analysis pipeline. Raw event data
are segmented into four game phases and 15-min temporal windows,
transformed into phase-specific attacking and defensive features, and
then clustered using DEC (autoencoder pretraining, K-Means initial-
ization, and KL-divergence refinement). Final cluster assignments are

```
aggregated to the team level via majority voting and subsequently used
for evaluation and validation, interpretability and explanation (feature
ablation, surrogate models, SHAP), tactical adaptation analysis (style
stability and within-match switching), and the derivation of holistic
multi-phase tactical archetypes
```

## Evaluation

```
We evaluate clustering quality by comparing Deep Embed-
ded Clustering (DEC) [ 2 ] with classical baselines (K-Means,
K-Medoids, and Ward’s hierarchical clustering) following
the benchmarking protocol of Moffatt et al. [ 5 ]. To broaden
the comparison beyond the original benchmark, we addi-
tionally include probabilistic and graph-based approaches:
Gaussian Mixture Models (GMM), optimized using the
Expectation–Maximization algorithm [ 25 ], and Spectral
Clustering [ 26 , 27 ]. In our implementation, GMM employs
full covariance matrices, allowing each component to cap-
ture correlations between features.
All methods are evaluated using the Silhouette score
together with the composite clustering quality metrics
A ( C ) 1 and A ( C ) 2. As introduced in Sect. 2 , these metrics
combine multiple internal clustering criteria—including
compactness, separation, centroid consistency, and den-
sity—to provide a more holistic assessment of clustering
quality than any single index alone. To ensure robustness,
each experiment is repeated across five random seeds, and
results are reported as the mean performance across runs.
Figure 2 shows that DEC consistently achieves the stron-
gest results for both the In-Possession and Out-of-Posses-
sion phases across all tested values of k , indicating improved
cluster compactness and separation relative to the baselines.
This advantage stems from DEC’s ability to jointly learn
feature representations and cluster assignments, allowing
the latent embedding space to adapt to the underlying tacti-
cal structure of the data. Similar trends are observed for the
transition phases and are reported in Appendix C. Overall,
these findings suggest that representation-aware cluster-
ing is particularly well suited for discovering latent tactical
structures in multi-phase football data.
Sensitivity analyses across k ∈[2 , 10] (Table 1 ) reveal
a consistent trade-off between the Silhouette score and the
composite agreement metrics A ( C ) 1 and A ( C ) 2. Across
all phases, k =2 produces the highest Silhouette values,
indicating the strongest cluster separation and compactness,
whereas k =3– 4 achieve the strongest AC1/AC2 scores. In
practice, the results for k =3 and k =4 are very similar,
suggesting that both configurations capture comparable lev-
els of structural agreement in the data.
In addition to clustering quality metrics, Table 1 reports
the Normalized Mutual Information (NMI) between cluster
assignments obtained from different random initializations,
which measures the consistency of clustering solutions
across runs [ 28 ]. Interestingly, stability patterns differ across
phases. In ball-controlling phases (In-Possession and Posi-
tive Transition), lower values of k tend to produce higher
NMI scores, indicating more stable cluster assignments
across random seeds. In contrast, in phases where teams do
```

longitudinal zones to retain positional context with limited
dimensionality [ 8 ], pass motifs obtained by labeling short
pass sequences (e.g., ABAB, ABCD) to capture recurrent
combinational patterns [ 10 ], and passing-graph connectiv-
ity metrics in which passes define a directed player network
and centrality summarizes ball circulation [ 9 ]. All fea-
tures are computed in a phase-aware manner, with events
assigned to IP/OP/PT/NT according to a possession-based
phase taxonomy [ 7 ]. Passes are categorized by angle (for-
ward, backward, side) and distance (short, medium, long),
with subtypes (e.g., high, smart) grouped to reduce noise
and counts normalized into frequency ratios globally and by
zone; shots are classified by distance from goal. Defensive
events comprise duels, runs, and fouls: runs are grouped
by direction and length, while duels and fouls are broken
down by context (e.g., aerial, ground, defensive). In total,
we construct 30 attacking-phase features and 45 defensive-
phase features; brief group-wise definitions are reported in
Appendix A.

### Deep Embedded Clustering and Cluster Assignment

To move beyond shallow clustering in a fixed feature space,
we adopt the Deep Embedded Clustering (DEC) framework
of Xie et al. [ 2 ]. DEC couples a deep autoencoder with a
clustering objective by first learning a low-dimensional
latent representation and then refining it via a Kullback–
Leibler (KL) divergence loss between a soft assignment dis-
tribution and a sharpened target distribution, following [ 2 ,
22 ]. In practice, we pretrain a symmetric fully connected
autoencoder on the normalized feature matrix, initialize
cluster centroids in the latent space using K-Means, and
then refine the encoder by minimizing the KL-based clus-
tering loss while keeping centroids fixed. Implementation
details, including network architecture, training schedule,
and optimization hyperparameters (ReLU activations [ 23 ],
Adam optimizer [ 24 ], and loss formulations), are provided
in Appendix B.
We train separate DEC models for each game phase
(In-Possession, Out-of-Possession, Positive Transition,
and Negative Transition). The latent dimensionality is set
to 10, and the number of clusters is fixed to _k_ =4 across
all phases, as supported by the evaluation results in Sect. 4.
Match-level cluster labels are obtained by taking the arg-
max over soft assignment probabilities. Since each match
is treated as a separate sample, teams may receive different
labels across the season; therefore, we derive a single phase-
specific team label via majority voting over all match-level
assignments within the corresponding phase. In addition to
this aggregated representation, we also report the full distri-
bution of match-level cluster assignments for each team to
capture match-to-match variation in playing styles.

```
competitive across all metrics, maintaining strong AC1/
AC2 scores together with comparable Silhouette and NMI
values. This choice therefore provides a good compromise
between clustering quality, stability, and tactical interpret-
ability, while enabling richer differentiation between play-
ing styles.
The cross-phase synthesis step aims to identify broader
tactical archetypes rather than fine-grained phase-level
styles. Accordingly, we adopt a coarser representation
( k =2) that summarizes the dominant tactical orientations
within each phase. This should be interpreted as a higher-
level aggregation of the phase-level clusters rather than a
separate clustering configuration, effectively forming a hier-
archical representation in which detailed phase-level styles
( k =4) are first identified within phases and then combined
into broader cross-phase archetypes ( k =2). Details of the
cross-phase analysis are provided in Sect. 7.
```

not control the ball (Out-of-Possession and Negative Transi-
tion), higher values of _k_ generally correspond to increased
NMI, suggesting that richer cluster structures are required to
capture the variability of defensive behaviors.
Considering these results jointly, we adopt _k_ =4 as the
primary phase-level configuration. Although phase-specific
values of _k_ could in principle be selected based on local
metric optima, doing so would hinder direct comparabil-
ity between phases and complicate the subsequent cross-
phase synthesis step. Using a uniform number of clusters
ensures that tactical structures identified in different phases
are expressed at a consistent level of granularity, facilitat-
ing meaningful comparison and aggregation across phases.
Empirically, _k_ =4 represents a balanced point across the
evaluated criteria: the composite agreement metrics _A_ ( _C_ ) 1
and _A_ ( _C_ ) 2 yield largely comparable results for _k_ =3 and
_k_ =4 across phases, while _k_ =4 remains consistently

**Fig. 2** Clustering performance across different numbers of clusters _k_ for In-Possession (left) and Out-of-Possession (right) phases. Results are
averaged over 5 random seeds

```
connectivity, and the ABCB motif frequency. Table 2 sum-
marizes these summaries.
The patterns in Table 2 support a clear ordering of styles.
Highly Proactive is characterized by the strongest circula-
tion signature (high passes/90, high connectivity, low high-
pass ratio) alongside the highest shooting volume, whereas
Reactive Direct shows the opposite configuration with
lower circulation and a higher high-pass tendency, consis-
tent with a more vertical profile. Balanced Proactive retains
much of the circulation structure of the proactive style while
incorporating more directness, and Moderately Reactive
occupies a mixed middle ground. These summaries moti-
vate the cluster labels used in the remainder of the paper.
```

## In-Possession Playing Styles: Structure,

## Importance, and Effectiveness

_Note: All findings reported in this section are based on the_
**_In-Possession_** _game phase. While the proposed approach is
applied to all four game phases independently, we focus on
In-Possession here for simplicity and clarity._

### Cluster Playing Characteristics

To attach tactical meaning to the discovered styles, we
report cluster-level averages for five indicative variables:
passes per 90, high-pass ratio, shots per 90, passing-network

**Table 1** Sensitivity of DEC clustering to the number of clusters ( _k_ ) for four phases of play
Phase k AC1 AC2 Silhouette NMI
_μ σ μ σ μ σ_
In-Possession 2 0.876 0.007 0.910 0.005 **0**. **988** 0.003 **0**. **579**
3 **0**. **883** 0.018 **0**. **917** 0.012 0.968 0.006 0.
**4** 0.875 0.028 0.916 0.019 0.943 0.014 0.
5 0.861 0.019 0.905 0.013 0.918 0.011 0.
6 0.858 0.025 0.907 0.018 0.910 0.018 0.
7 0.845 0.017 0.900 0.008 0.902 0.011 0.
8 0.846 0.024 0.899 0.014 0.876 0.011 0.
9 0.825 0.031 0.887 0.022 0.863 0.021 0.
10 0.824 0.029 0.886 0.019 0.859 0.019 0.
Out-of-Possession 2 0.847 0.023 0.888 0.017 **0**. **989** 0.002 0.
3 0.873 0.020 0.906 0.014 0.979 0.005 0.
**4 0**. **876** 0.011 **0**. **909** 0.009 0.974 0.006 0.
5 0.869 0.013 0.906 0.007 0.971 0.007 0.
6 0.780 0.101 0.854 0.059 0.965 0.006 0.
7 0.785 0.076 0.861 0.045 0.968 0.004 0.
8 0.794 0.060 0.855 0.036 0.961 0.008 0.
9 0.746 0.099 0.819 0.068 0.955 0.008 0.
10 0.762 0.072 0.829 0.048 0.950 0.008 **0**. **422**
Positive Transition 2 0.848 0.043 0.897 0.022 **0**. **973** 0.009 0.
3 **0**. **903** 0.009 **0**. **931** 0.006 0.966 0.002 **0**. **393
4** 0.881 0.016 0.918 0.010 0.932 0.005 0.
5 0.880 0.017 0.921 0.010 0.919 0.007 0.
6 0.874 0.032 0.919 0.020 0.906 0.016 0.
7 0.862 0.011 0.911 0.006 0.889 0.013 0.
8 0.874 0.018 0.920 0.010 0.893 0.014 0.
9 0.851 0.007 0.907 0.007 0.881 0.009 0.
10 0.860 0.004 0.913 0.002 0.875 0.009 0.
Negative transition 2 0.848 0.011 0.889 0.008 **0**. **989** 0.002 0.
3 0.882 0.017 0.915 0.009 0.984 0.006 0.
**4 0**. **901** 0.029 **0**. **932** 0.017 0.980 0.003 0.
5 0.801 0.074 0.867 0.048 0.974 0.005 0.
6 0.757 0.108 0.851 0.069 0.972 0.010 0.
7 0.788 0.034 0.873 0.018 0.969 0.011 0.
8 0.755 0.077 0.850 0.052 0.968 0.005 0.
9 0.773 0.058 0.857 0.033 0.968 0.006 0.
10 0.742 0.060 0.841 0.039 0.959 0.010 **0**. **597**
Values show mean ( _μ_ ) and standard deviation ( _σ_ ) across random initializations. Stability is measured using average NMI [ 28 ] across seeds.
Bold values indicate the best result for each metric within each phase

```
Ablation of Passing Volume and Network Structure , rep-
resented by features like Total Passes and Network Connec-
tivity , primarily affects centroid alignment and team-level
stability, highlighting the role of circulation intensity and
structural cohesion in maintaining consistent team identities
across matches.
In contrast, Passing Directionality —captured by features
such as Forward Pass Ratio and Backward Pass Ratio in
Zone 2 —mainly influences inter-cluster geometry while
preserving relatively high silhouette values, indicating that
directional intent shapes separation between playing styles
rather than within-style compactness.
Finally, Passing Motifs and Combinational Patterns ,
exemplified by motifs such as ABCB and ABCD , exhibit the
smallest performance degradation. This suggests that micro-
level combinational structures complement—but do not
dominate—the higher-level tactical representations learned
by DEC. Overall, the ranked ablation results confirm that
DEC captures hierarchically organized and tactically mean-
ingful information, with spatial risk-taking emerging as the
most decisive component of in-possession playing styles.
```

### Feature-Level Interpretability via Surrogate Models

```
To further examine the internal structure of the playing
styles identified in Sect. 5.1, we conduct a feature-level
interpretability analysis using supervised surrogate models
trained to predict DEC cluster assignments from the original
feature space. This approach enables a controlled inspection
of which observable match-event features most strongly
drive cluster membership, providing a complementary per-
spective to the ablation analysis in Sect. 5.2 and offering a
bridge between latent representations and domain-interpre-
table football metrics.
We evaluate three candidate surrogate models—multi-
nomial logistic regression [ 30 ], XGBoost [ 31 ], and Light-
GBM [ 32 ]—using DEC cluster assignments as labels. As
reported in Table 4 , multinomial logistic regression achieves
the highest accuracy and macro-F1 score, indicating the
closest alignment with the DEC-derived cluster structure.
This result suggests that the learned playing styles are close
to linearly separable in the original feature space, indicating
that the DEC-derived clusters can be approximated using
```

### Feature Group Importance via Ablation Analysis

Table 3 presents a ranked feature ablation analysis assess-
ing the relative importance of semantic feature groups for
learning stable in-possession playing styles using DEC.
Feature importance is evaluated using a complementary set
of metrics capturing cluster consistency, geometric struc-
ture, and overall clustering quality. In particular, Normal-
ized Mutual Information (NMI) and Adjusted Rand Index
(ARI) measure the agreement between cluster assignments
obtained from the full model and each ablated variant in
a permutation-invariant manner, making them well suited
for assessing the dependence of learned tactical groupings
on specific feature groups [ 28 , 29 ]. To account for struc-
tural effects beyond label agreement, we additionally report
silhouette scores, centroid drift, and composite clustering
quality indices (AC1, AC2), providing a concise yet holistic
evaluation of representation stability and quality.
Removing the _Spatial Passing Risk Profile_ —which
includes features such as _High Pass Ratio in Zone 3_ and
_Low Pass Ratio in Zone 1_ —results in the most pronounced
degradation across all metrics. In particular, both AC1 and
AC2 collapse to near-zero values, accompanied by sub-
stantial reductions in cluster consistency, indicating that
spatially conditioned passing risk is the dominant factor
governing tactical separability during sustained possession.
The _Shooting Volume and Shot Selection_ group ranks
second in importance. Features such as _Total Shots_ and _Near
Shot Ratio_ meaningfully contribute to cluster structure, sug-
gesting that final-third behavior informs possession arche-
types even in a fully unsupervised setting.

**Table 2** Cluster-level averages of representative attacking features
Cluster Passes/90 High
Pass
Rat.

```
Shots/90 Connectivity ABCB
Fr.
```

Reactive
Direct

```
302.7 0.21 9.1 6.7 0.
```

Highly
Proactive

```
576.9 0.10 14.3 8.1 0.
```

Moderately
Reactive

```
375.8 0.18 10.1 7.3 0.
```

Balanced
Proactive

```
453.9 0.14 10.8 7.7 0.
```

**Table 3** Ranked feature group ablation results for the In-Possession phase using DEC
Setting NMI ARI Centroid drift Team stability Silhouette #Feat. AC1 AC
Full Model (All Feature Groups) 1.00 1.00 0.00 1.00 0.95 30 0.99 0.
w/o Spatial Passing Risk Profile 0.25 0.21 16.82 0.18 0.90 22 0.01 0.
w/o Shooting Volume & Shot Selection 0.49 0.46 17.64 0.22 0.91 26 0.21 0.
w/o Passing Volume & Network 0.40 0.35 18.30 0.08 0.93 28 0.59 0.
w/o Passing Directionality 0.44 0.40 19.53 0.29 0.94 18 0.65 0.
w/o Passing Motifs & Combinational Patterns 0.45 0.41 15.43 0.14 0.94 26 0.77 0.
Each row reports performance after _removing_ the corresponding feature group from the full feature set

```
K-Medoids, Ward, GMM, and Spectral Clustering under
matched experimental conditions (Sect. 4 ), indicating that
the improvement arises from the DEC clustering objective
rather than from the engineered features alone.
Figure 3 presents global feature importance derived from
the logistic regression surrogate, computed as the mean
absolute standardized coefficient across clusters. The most
influential features are dominated by passing volume (e.g.,
Total Passes), directional tendencies (Forward and Side
Pass Ratios), spatially conditioned circulation metrics, and
passing-network connectivity. This distribution indicates
that both overall possession intensity and spatial organiza-
tion are central to differentiating the learned playing styles,
closely aligning with the ranked feature ablation results dis-
cussed in Sect. 5.2.
To provide a more granular, style-specific perspective,
Table 5 reports the strongest positive and negative feature
drivers for each playing style cluster. These drivers indicate
how deviations in individual features increase or decrease
the likelihood of assignment to a given cluster under the
surrogate model. Importantly, rather than introducing new
tactical interpretations, these results corroborate the qualita-
tive characterizations presented in Sect. 5.1, demonstrating
that the DEC-derived styles are grounded in coherent and
intuitively meaningful feature contributions.
While coefficient-based analysis provides a compact
global summary, it does not fully capture how feature val-
ues interact with cluster predictions across individual teams.
```

relatively simple decision boundaries and reinforcing the
interpretability of the resulting playing styles. Owing to
its strong predictive performance, stability, and transparent
parameterization, we adopt multinomial logistic regression
as the primary surrogate model for subsequent analysis.
The high surrogate accuracy indicates that DEC cluster
assignments can be closely approximated using the original
engineered features. In our pipeline, however, cluster struc-
ture is determined through the DEC optimization proce-
dure, which refines cluster assignments by minimizing the
KL-divergence objective after initializing centroids in the
latent space. This process improves cluster compactness and
stability relative to applying classical clustering methods
directly to the engineered feature space. Empirically, this
behavior is reflected in the stronger Silhouette and AC met-
rics observed for DEC across the tested values of _k_. The sur-
rogate analysis therefore confirms that the discovered styles
remain interpretable in terms of the original match-event
features, while the clustering structure itself results from the
DEC optimization process. In particular, DEC consistently
achieves higher Silhouette and AC scores than K-Means,

**Table 4** Performance comparison of supervised surrogate models pre-
dicting DEC cluster assignments
Model Accuracy Macro-F
Logistic regression (multinomial) 0.945 0.
XGBoost 0.911 0.
LightGBM 0.893 0.

**Fig. 3** Global feature importance of the top 15 features according to the logistic regression surrogate model

```
given cluster), while the color encodes the standardized fea-
ture value, enabling simultaneous inspection of both impor-
tance and directional effect.
The beeswarm visualizations reveal that the learned play-
ing styles are primarily differentiated along a possession–
directness continuum. For the Highly Proactive cluster,
high values of Total Passes and Connectivity consistently
produce strong positive SHAP values, indicating that dense
passing networks and sustained possession are defining
characteristics. In contrast, the Reactive Direct cluster is
associated with low passing volume and sparse connectiv-
ity, while high forward pass ratios exert positive influence,
reflecting a preference for vertical progression and rapid
attacking transitions.
The Balanced Proactive cluster exhibits similar posses-
sion-oriented features but with narrower SHAP distribu-
tions and reduced magnitude, suggesting a moderated and
more flexible use of ball circulation. Meanwhile, the Mod-
erately Reactive cluster occupies an intermediate regime,
where neither possession dominance nor extreme directness
consistently drives cluster membership. Across all clusters,
zone-specific pass ratios and passing motifs further refine
stylistic distinctions, illustrating how teams operationalize
possession spatially rather than merely accumulating pass
volume.
Overall, the SHAP analysis complements the coefficient-
based surrogate interpretation by exposing both global
and local feature effects, confirming that the DEC clusters
```

To address this limitation, we further analyze the surrogate
model using Shapley Additive Explanations (SHAP), which
decompose each prediction into additive feature contribu-
tions while preserving local accuracy.

**Shapley Analysis for Explainability**

Figures 4 and 5 present SHAP beeswarm plots for the four
playing-style clusters, visualizing the distribution, direction,
and magnitude of feature contributions across all teams. In
each subplot, the horizontal axis represents the SHAP value
(i.e. the contribution of a feature toward or away from a

**Table 5** Top positive and negative feature drivers per playing style
(logistic regression surrogate of DEC clusters)
Playing Style Top 3 Negative Drivers Top 3 Positive
Drivers
Reactive
Direct

```
Total Passes; Low Pass Ratio
(Total); Side Pass Ratio
```

Forward Pass Ratio;
High Pass Ratio
(Total); High Pass
Ratio (Zone 2)
Highly
Proactive

```
Forward Pass Ratio; High
Pass Ratio (Zone 2); Forward
Pass Ratio (Zone 2)
```

Side Pass Ratio;
Total Passes;
Connectivity
Moderately
Reactive

```
Total Passes; Connectivity;
Side Pass Ratio
```

Forward Pass Ratio;
High Pass Ratio
(Zone 1); High Pass
Ratio (Zone 3)
Balanced
Proactive

```
High Pass Ratio (Zone 3);
High Pass Ratio (Zone 1);
ABAB Motif Frequency
```

```
Total Passes; Con-
nectivity; Low Pass
Ratio (Zone 2)
```

**Fig. 4** SHAP beeswarm plots for the Reactive Direct and Moderately Reactive clusters under the multinomial logistic-regression surrogate, show-
ing feature contributions to each cluster’s logit (softmax score)

```
phase-specific summaries to temporal adaptation, cross-
phase coherence, and holistic archetypes.
```

## Tactical Adaptation Across Temporal Scales

```
This section extends the work by explicitly incorporating the
temporal dimension of the underlying spatio-temporal event
data. Each event in the dataset is characterized by four key
components: team and player identifiers, event type, spatial
information given by start and end locations, and an exact
timestamp. In the preceding sections, tactical representa-
tions and playing styles were derived primarily from event
types, participant identities, and spatial structure, effec-
tively capturing what actions occurred and where they took
place. Here, we additionally leverage the temporal ordering
of events to examine when tactical behaviors emerge and
evolve within matches. By integrating time through fixed
15-min windows, this section enables a multi-scale analysis
of tactical adaptation, allowing us to extract richer insights
from the data and move closer to fully exploiting its spatio-
temporal structure.
```

correspond to tactically meaningful and interpretable differ-
ences in passing behavior, spatial control, and progression
strategy. Together with the ablation study, these results rein-
force the internal consistency and explanatory validity of
the proposed playing-style representations.

### Match Effectiveness and League Context

Figure 6 summarizes style-versus-style win percentages,
providing an outcome-grounded view of how the learned
styles perform against different opponent profiles. The heat-
map indicates that styles closer to the ends of the attacking
spectrum tend to achieve stronger matchup performance
than more intermediate profiles, suggesting that stylistic
specialization can translate into competitive advantages in
head-to-head settings.
To contextualize playing styles across competitions, we
report league-wise distributions of cluster assignments in
Appendix D (Table 11 , Fig. 18 ). These supplementary anal-
yses present match-level style distributions across leagues
together with team-level cluster compositions. The results
show that all four playing styles are broadly represented
across competitions, with relatively balanced distributions
across leagues and only modest variations in their relative
frequencies. In the remainder of the paper, we shift from

**Fig. 5** SHAP beeswarm plots for the Balanced Proactive and Highly Proactive clusters under the multinomial logistic-regression surrogate, show-
ing feature contributions to each cluster’s logit (softmax score)

```
median win rates are broadly comparable across different
change counts, the tactically rigid group exhibits greater dis-
persion in outcomes. Importantly, this group also contains
a substantially larger number of teams, concentrating both
high- and low-performing sides within the zero-change cat-
egory. As a result, the observed heterogeneity likely reflects
group composition rather than a systematic stabilizing effect
of tactical rigidity. Overall, the team-level analysis indicates
that style change frequency alone is not a reliable determi-
nant of average season success, motivating a more detailed
match-level investigation.
```

### Match-Level Tactical Adaptation and Outcome Risk

```
To complement the season-level analysis, we examine the
relationship between within-match tactical adaptation and
match outcomes. Rather than aggregating behavior across
the season, this analysis considers each team-match instance
separately and focuses on style variation occurring during a
single match.
While this analysis captures temporal variation in playing
style, it does not explicitly incorporate time-varying match
context variables such as scoreline at each window, red
cards, opponent strength within the match, or game location.
```

### Team-Level Style Stability and Season Outcomes

We first analyze tactical adaptation at the team level by
examining whether the frequency of style changes across
15-min match windows is associated with season-level suc-
cess. For each team, a _style change count_ is computed by
first aggregating match events into six fixed temporal win-
dows (0–15, 15–30, ..., 75–90+ minutes). For each window,
a dominant playing style is assigned via majority voting over
all matches, consistent with the aggregation procedure used
for the full-season team representations. The style change
count then corresponds to the number of cluster transitions
observed across these six window-level assignments. Team
performance is measured by season win rate.
Statistical analysis reveals no significant monotonic
relationship between style change frequency and win rate
(Spearman _ρ_ =− 0*.* 17 , _p_ =0*.* 10 ; [ 33 ]), nor a significant
difference in win-rate distributions between tactically
rigid teams and teams exhibiting at least one style change
(Mann–Whitney U test, _p_ =0*.* 24 ; [ 34 ]). Polynomial regres-
sion similarly fails to identify a meaningful linear or non-
linear association.
Figure 7 visualizes the distribution of season win rates
as a function of team-level style change frequency. While

**Fig. 6** Pairwise win percentages between playing-style clusters (matchup heatmap)

```
Table 6 summarizes the statistical tests assessing the
association between match-level style switching and loss
probability, including non-parametric correlation and dis-
tributional comparisons (Spearman correlation and Mann–
Whitney U test). Descriptively, the probability of losing a
match increases monotonically with the number of style
switches, rising from 27.2% for matches with no switches
to over 44% for matches with five switches. This monotonic
relationship is visualized in Fig. 8 , which shows both the
empirical loss rates and the corresponding logistic regres-
sion estimates across different levels of within-match style
switching.
Logistic regression analysis confirms this pattern [ 30 ]:
each additional within-match style switch is associated with
higher odds of losing the match. In the univariate model, the
estimated odds ratio is 1.17 per switch ( p< 0. 001 ). Impor-
tantly, this effect remains significant after controlling for
team strength using season-level win rate, indicating that
the association is not solely driven by weaker teams switch-
ing styles more frequently.
A non-parametric Mann–Whitney U test further sup-
ports this result, revealing a significant difference in loss
distributions between tactically rigid matches and matches
```

These factors are known to influence tactical behavior and
may also affect the likelihood of style switching. Con-
sequently, the following results should be interpreted as
descriptive associations rather than causal evidence of the
effects of tactical adaptation.
For each match, playing styles are inferred independently
for six consecutive 15-min windows using the frozen DEC
model. The _match-level style change count_ is defined as the
number of cluster transitions between adjacent windows.
Match outcomes are encoded as a binary variable indicating
loss versus non-loss (win or draw).

**Table 6** Match-level statistical analysis of style switching and loss
probability
Analysis Estimate Significance
Overall loss rate 0.376 –
Loss rate (0 switches) 0.272 –
Loss rate ( _>_ 0 switches) 0.382 –
Spearman _ρ_ (switches vs. loss) 0.17 _p<_ 0*.* 001

Mann–Whitney U (0 vs. _>_^0 switches) – _p_ =0*.* 001
Logit: switches → loss (uncontrolled) OR = 1.17 _p<_ 0*.* 001
Logit: switches → loss (controlled for
win rate)

```
OR = 1.11 p< 0. 001
```

**Fig. 7** Distribution of season win rates by team-level style change
count. Each box represents the distribution of win rates for teams
exhibiting a given number of style switches across 15-min match win-
dows. Median win rates are similar across groups; however, the tacti-

```
cally rigid category contains a larger number of teams and exhibits
greater outcome dispersion, reflecting increased heterogeneity within
this group
```

```
because the present analysis does not explicitly model time-
varying match context variables (e.g., scoreline dynam-
ics, red cards, or home advantage), these results should
be interpreted cautiously. Future work incorporating such
contextual factors could help distinguish proactive tactical
adaptation from reactive responses to adverse game states.
```

### Temporal Shifts in Playing Style Popularity

```
Figure 9 illustrates the relative popularity of the learned
playing styles across successive 15-min match windows.
A consistent temporal trend is observed: proactive playing
```

exhibiting at least one style switch ( _p<_ 0*.* 01 ). Together,
these findings indicate that within-match tactical switching
is associated with higher loss probability and does not con-
sistently correspond to successful adaptation.
When interpreted alongside the season-level results, a
coherent picture emerges. While tactical flexibility across
matches is not associated with higher average season
success, matches featuring frequent within-match style
switching exhibit higher observed loss probabilities. One
plausible interpretation is that teams alter their tactical style
in response to unfavorable match conditions, such as chas-
ing the score or responding to opponent pressure. However,

**Fig. 9** Temporal distribution of playing style prevalence across 15-min
match windows. The share of proactive playing styles is highest in
early match phases, whereas the Reactive Direct style becomes

```
increasingly dominant toward the end of matches, potentially reflect-
ing adjustments to evolving match conditions
```

**Fig. 8** Empirical and predicted loss probabilities, based on number of style changes in a match

```
define cross-phase tactical coherence as the extent to which
a team preserves its dominant style between holding and
transition phases, and to study how coherent phase-specific
styles combine into holistic archetypes and how effective
these archetypes are in terms of match outcomes.
```

### Cross-Phase Tactical Coherence

```
To analyze how tactical behaviors are coordinated across
phases, we examine the consistency of cluster assignments
obtained independently for each game phase. For interpret-
ability, we set the number of clusters to k =2 per phase,
yielding 24 =16 possible phase-combination archetypes.
This configuration differs from the phase-level clustering
discussed earlier, where k =4 was used to capture finer tac-
tical distinctions within each phase. The purpose of the pres-
ent analysis, however, is not to rediscover phase-specific
styles but to study how these styles interact across phases.
Accordingly, the clusters are intentionally aggregated into
two broader categories per phase, representing the domi-
nant tactical orientations within the attacking and defensive
spectra. Preliminary exploration with larger k values at this
stage produced increasingly fragmented archetypes that
were difficult to interpret holistically and did not yield qual-
itatively distinct strategic identities. Using k =2 therefore
provides a compact and interpretable abstraction layer that
summarizes how phase-level styles combine into broader
tactical archetypes, while the underlying phase-level clus-
tering remains unchanged.
Within each phase, cluster characteristics are summarized
by the mean values of a small set of representative features,
providing a coherent basis for cross-phase comparison.
Tables 7 and 8 show that the clustering recovers stable
attacking and defensive identities across holding and tran-
sition phases. As expected, absolute event frequencies are
higher in IP and OP than in PT and NT, reflecting the shorter
duration of transition phases. In attack, clusters with higher
passing volume, lower high-pass ratios, and greater shot
production correspond to possession-oriented build-up,
```

styles are more frequently adopted in the early phases of
matches, while the Reactive Direct style gradually increases
in popularity as the game progresses, particularly during the
final 15 min and added time.
During the first half, teams tend to favor proactive styles–
associated with higher ball circulation, structured build-up,
and positional control—reflecting an initial adherence to
pre-match tactical plans. This pattern suggests that teams
commonly attempt to impose their preferred playing iden-
tity early in the match, before contextual factors such as
scoreline and time pressure become more influential.
In the second half, a moderate but steady shift toward
reactive direct styles can be observed, with the highest
relative share occurring in the closing stages of the match.
Although this increase is not sudden, it is compatible with
well-established football dynamics: as matches progress,
teams may increasingly adopt more risk-sensitive behaviors
in response to scoreline pressure, fatigue, or broader strate-
gic considerations.
Overall, the temporal redistribution of playing styles
shown in Fig. 9 indicates that tactical behavior evolves
gradually over the course of a match, adapting to chang-
ing temporal and contextual demands rather than exhibiting
sharp phase transitions.

## Cross-Phase Tactical Coherence and Holistic

## Archetypes

Up to this point, playing styles have been analyzed sepa-
rately within each game phase. However, team identity in
football is shaped not only by what happens during sus-
tained attack or defense, but also by how those behaviors
carry over into transitions. Because In-Possession (IP) and
Positive Transition (PT) share an attacking feature space,
and Out-of-Possession (OP) and Negative Transition (NT)
share a defensive one, teams can be placed on common IP–
PT and OP–NT spectra (from positional to direct attack,
and from pressing to low-block defense). This allows us to

**Table 7** Playing characteristics of clusters across IP–PT game phases
Phase Cluster Passes/90 High Pass Rat. Shots/90 Connectivity ABCB Fr.
IP Positional Pos 515.9 0.11 12.5 7.9 0.
IP Direct Prog 341.4 0.19 9.7 7.0 0.
PT Positional Pos 291.8 0.12 5.5 6.5 0.
PT Direct Prog 245.2 0.16 4.2 5.8 0.

**Table 8** Playing characteristics of clusters across OP–NT game phases
Phase Cluster Acc./90 For. Run/90 Gr. Duel/90 Short Run/90 Foul/
OP Intense Press 9.1 8.1 77.6 3.2 12.
OP Low-Block Def 3.3 4.0 68.0 1.3 11.
NT Intense Press 6.5 5.8 42.1 2.3 6.
NT Low-Block Def 2.7 2.5 38.3 0.8 6.

### Holistic Tactical Archetypes and Their Effectiveness

```
Figure 12 summarizes the 16 holistic tactical archetypes
obtained by combining clustering outcomes across all four
game phases. By jointly modeling attacking and defensive
behavior in both holding and transition phases, these arche-
types describe system-level tactical identities rather than
isolated phase-specific styles.
The left panel shows that two archetypes dominate: Pro-
active Dominant and Reactive Direct. This suggests that
teams generally favor cross-phase consistency, either cou-
pling possession-based attack with high-intensity pressing
and rapid ball recovery, or pairing direct attacking play with
compact low-block structures and counterattacking focus.
The right panel reports win percentages for each arche-
type, linking stylistic prevalence to competitive effec-
tiveness. Archetypes that maintain a possession-oriented
attacking style across both In-Possession and Positive Tran-
sition phases, combined with selective or sustained press-
ing, achieve the highest win rates, whereas profiles with
abrupt cross-phase shifts (e.g., possession build-up plus
direct transitions and persistent pressing) perform markedly
worse, indicating tactical instability.
```

whereas lower circulation and higher high-pass ratios char-
acterize more direct play. These patterns persist from IP to
PT, yielding consistent _Positional Possession_ and _Direct
Progression_ clusters. On the defensive side, high values
of accelerations, runs, duels, and fouls are associated with
_Intense Pressing_ , while uniformly lower values describe
_Low-Block Defense_ , again consistently observed in both OP
and NT.
Figures 10 and 11 visualize cross-phase transitions
within shared feature spaces (IP–PT and OP–NT), ensuring
that differences reflect genuine tactical adjustments rather
than representation changes. Defensive transitions display
pronounced asymmetry: only a small fraction of low-block
teams in OP switch to pressing in NT, whereas many press-
ing teams fall back into more conservative structures imme-
diately after losing possession. This suggests that negative
transitions are treated as high-risk situations in which teams
prioritize regrouping and compactness over aggressive ball
recovery. In contrast, attacking styles show high cross-phase
coherence: most teams maintain their dominant attack-
ing identity during positive transitions, indicating that ball
recovery is primarily seen as an opportunity to exploit oppo-
nent disorganization rather than a cue for stylistic change.

**Fig. 12** Holistic phase-combination archetypes. Left: distribution of teams across the 16 archetypes derived from joint clustering outcomes across
all four game phases. Right: win percentages for each archetype

**Fig. 11** Style transitions between
OP and NT clusters

**Fig. 10** Style transitions between
IP and PT clusters

## Temporal Stability via Frozen-Model

## Evaluation

```
To assess whether DEC captures temporally persistent
playing-style representations rather than season-specific
patterns, we conduct a frozen-model evaluation in which
the encoder and cluster centroids learned from first-half
matches are applied directly to second-half data without
retraining. This setup provides a strict test of temporal
robustness under distribution shift. All results are averaged
over five random seeds.
As shown in Figs. 14 and 15 , DEC exhibits a noticeable
performance decrease when applied to second-half data
across all phases. This decrease is larger in absolute terms
than that observed for classical clustering baselines, which
is expected given the fundamentally different modeling
capacities of the methods. Traditional algorithms operate in
a fixed feature space and achieve relatively modest in-sam-
ple performance, inherently limiting their potential degrada-
tion under distribution shift. In contrast, DEC learns highly
compact and well-separated latent representations, resulting
in a higher performance ceiling and, consequently, a larger
observable drop when evaluated on second-half matches.
Despite this decline, DEC maintains clear superiority
on second-half matches in terms of Silhouette Score and
A ( C ) 2 , and remains competitive with or slightly better than
baseline methods according to A ( C ) 1. This indicates that
the learned representations generalize meaningfully beyond
the training period rather than overfitting first-half patterns.
```

Overall, Fig. 12 shows that not all coherent cross-phase
configurations are equally successful: stylistic prevalence
and competitive effectiveness only partially overlap, and a
limited subset of holistic archetypes underpins the most suc-
cessful teams.

### Uncertainty and Robustness Analysis

To quantify uncertainty in archetype-level win probabili-
ties, we compute 95% non-parametric bootstrap confi-
dence intervals (1000 resamples) [ 35 ]. For each archetype,
we resample the corresponding _team-match_ observations
with replacement and recompute the win percentage as the
mean of a binary win indicator; 95% intervals are obtained
using the percentile method (2.5th and 97.5th percentiles).
This is particularly relevant because archetypes occur with
unequal frequencies, yielding different levels of estimation
uncertainty.
Figure 13 shows that possession-oriented archetypes
exhibit both higher mean win rates and relatively tight
confidence intervals, indicating stable performance across
matches. In contrast, hybrid archetypes characterized by
sharp cross-phase style shifts display wider intervals, con-
sistent with smaller sample sizes and greater outcome vari-
ability. Overall, the uncertainty analysis supports that the
archetype-level differences reported in the main results are
not driven by isolated performance spikes.

**Fig. 13** Archetype-level win percentages with 95% bootstrap confidence intervals (1000 resamples)

```
A key contribution of the journal version is a set of anal-
yses that connect the learned styles to temporal behavior,
robustness, and cross-phase structure. Using fixed 15-min
match windows, we quantify within-match style switching
and relate tactical adaptation to match-level risk. We further
evaluate temporal robustness with frozen-model inference,
transferring first-half-trained DEC models to second-half
data without retraining to test generalization under temporal
distribution shift. To make the discovered styles actionable,
we complement clustering with feature-group ablation,
supervised surrogate modeling, and SHAP-based expla-
nations [ 3 ], providing both feature-family attribution and
style-specific drivers.
Beyond phase-wise results, we introduce inter-phase
tactical coherence to measure stylistic continuity between
holding and transition phases. The coherence analysis
reveals a systematic asymmetry between attack and defense,
```

## Conclusion

This paper advances data-driven football tactical analysis
by providing an interpretable, phase-aware framework for
discovering team playing styles from event data. Rather
than treating style as a single monolithic construct, we
model tactics across four possession-driven phases (IP,
OP, PT, NT) and represent match behavior using spatial,
network-based, and motif-derived features. Deep Embed-
ded Clustering (DEC) [ 2 ] is used to learn phase-specific
cluster-oriented representations from team-match instances,
which are then aggregated into stable team-level style labels
via majority voting, while also reporting the distribution of
match-level cluster assignments to capture match-to-match
variation in playing styles.

**Fig. 14** Frozen-model evaluation for In-Possession (left) and Out-of-Possession (right) phases. Models are trained on first-half matches and evalu-
ated on first-half (dashed) and second-half (solid) data. Results are averaged over 5 random seeds

```
capture collective spatial organization and off-ball move-
ment patterns. While event data provide broad coverage
across leagues and competitions, they primarily describe
on-ball actions and therefore only partially reflect the full
tactical structure of teams. The current analyses also abstract
away from certain contextual match variables—such as
scoreline dynamics, player availability, or opponent-spe-
cific adjustments—that may influence tactical behavior and
style switching. Future work may extend the analysis across
multiple seasons to study the long-term evolution and per-
sistence of playing styles, integrate tracking data to better
represent spatial organization and defensive structure, and
incorporate richer contextual variables describing match
state and opponent strength. Combining data-driven style
discovery with expert annotations or coaching knowledge
could further strengthen the tactical interpretation of clusters
and enhance the usefulness of the framework for practical
```

and motivates a holistic view in which phase-level styles
are combined into multi-phase archetypes capturing joint
attacking and defensive identities. We link these archetypes
to practical relevance through matchup-based outcome
analysis and league-wise distributions, and report uncer-
tainty using bootstrap confidence intervals [ 35 ] to support
robust archetype-level comparisons.
Overall, the proposed pipeline integrates deep unsuper-
vised learning with temporally grounded evaluation, inter-
pretability tooling, and cross-phase synthesis, enabling
principled comparisons of tactical systems across teams,
leagues, and match contexts. These outputs can support
applications such as opponent profiling, match preparation,
and broader benchmarking of tactical identities.
_Limitations and Future Work._ The study is based on a
single season of event data and does not incorporate track-
ing-derived off-ball positioning, which limits the ability to

**Fig. 15** Frozen-model evaluation for Positive Transition (left) and Negative Transition (right) phases. Models are trained on first-half matches and
evaluated on first-half (dashed) and second-half (solid) data. Results are averaged over 5 random seeds

## Appendix B: DEC Implementation and

## Training Details

```
This appendix summarizes the implementation and train-
ing details of the Deep Embedded Clustering (DEC) models
used in this study. For each game phase, we train a separate
DEC model following the procedure of Xie et al. [ 2 ].
```

### Autoencoder Pretraining

```
Let xi ∈R D denote the normalized feature vector for team–
match instance i. A symmetric fully connected autoencoder
is first pretrained to learn a low-dimensional latent represen-
tation zi ∈R dz. The encoder consists of three dense layers
with ReLU activations [ 23 ], mapping
```

```
D → 128 → 64 → dz,
```

```
and the decoder mirrors this structure,
```

```
dz → 64 → 128 → D.
```

```
The autoencoder is trained to minimize the mean squared
reconstruction error
```

#### L AE =

#### 1

#### N

#### ∑ N

```
i =
```

```
∥ xi − x ˆ i ∥^22 ,
```

applications such as opponent scouting, match preparation,
and decision support in professional football environments.

## Appendix A: Feature Definitions

This appendix summarizes the hand-crafted features used
as inputs to the Deep Embedded Clustering (DEC) models.
For each team-match instance and game phase, we construct
attacking-phase features (Table 9 ) and defensive-phase fea-
tures (Table 10 ) that quantify passing behavior, shooting,
duels, fouls, clearances, and off-ball movement.
The pitch is partitioned into three longitudinal zones:
Zone 1 (closest to the team’s own goal), Zone 2 (central
third), and Zone 3 (closest to the opponent’s goal). Many
features are computed separately in each zone, as actions in
Zone 1 and Zone 3 cannot be treated as tactically equivalent.
For example, a high-risk pass or foul near one’s own penalty
area carries very different implications than the same action
near the opponent’s box. This spatial distinction is there-
fore essential for revealing playing styles that differ not only
in what actions teams perform, but also where on the pitch
they perform them.
Tables 9 and 10 report the feature groups, representa-
tive feature names, and brief descriptions for attacking and
defensive phases, respectively. These grouped definitions
correspond to the semantic feature families used in the abla-
tion and interpretability analyses in the main text.

**Table 9** Attacking-phase feature groups and definitions. Ratios are
normalized by relevant event totals. Zone-specific features are com-
puted for each of the three longitudinal pitch zones
Feature group Feature(s) Definition
G1 – Passing Vol-
ume & Network

Total Passes Completed passes per
match (per 90)
Connectivity Passing-graph connectiv-
ity / centrality summary
G2 – Passing
Motifs

```
ABAB, ABCA,
ABCB, ABCD
```

Relative frequency of
short pass motifs (player-
sequence patterns)
G3 – Passing
Directionality

```
Backward / For-
ward / Side Pass
Ratios (global)
```

```
Share of passes by direc-
tion over all passes
```

```
Backward / For-
ward / Side Pass
Ratios (by zone)
```

Directional pass shares
computed separately for
Zones 1–
G4 – Pass Height /
Risk Profile

```
High-pass / Low-
pass Ratios (total)
```

```
Share of high vs. low
passes (overall)
High-pass / Low-
pass Ratios (by
zone)
```

High/low pass shares
computed separately for
Zones 1–
G5 – Shooting Total Shots Shots per match (per 90)
Far / Middle / Near
Shot Ratios

```
Share of shots by dis-
tance band to goal
```

```
Table 10 Defensive-phase feature groups and definitions. Counts can
be expressed per match (per 90). Zone-specific features are computed
for each of the three longitudinal pitch zones
Feature group Feature(s) Definition
G6 – Duels Air Duels (total &
by zone)
```

```
Aerial duel counts over-
all and in Zones 1–
Ground Duels (att./
def./loose; total &
by zone)
```

```
Ground duel counts by
context, overall and in
Zones 1–
G7 – Fouls &
Infractions
```

```
Fouls (total & by
zone)
```

```
Foul counts overall and
in Zones 1–
Foul Types & Dis-
ciplinary Actions
```

```
Counts of foul/infraction
subtypes (e.g., hand, late-
card, protest, time-loss)
G8 – Interventions Touches (total & by
zone)
```

```
Defensive touches over-
all and in Zones 1–
Clearances & GK
Leaving Line
```

```
Clearances and GK
leaving-line events
G9 – Running &
Acceleration
```

```
Runs by Zone Run counts in Zones 1–
```

```
Runs by Direction Run counts by direction
(forward/back/side)
Runs by Length Run counts by length
(short/mid/long)
Acceleration
Metrics
```

```
Acceleration count, mean
acceleration length, and
forward runs in Zone 3
```

#### L KL =KL( P ∥ Q )=

#### ∑

```
i
```

#### ∑

```
j
```

```
pij log
pij
qij
```

#### .

```
During refinement, the encoder parameters are updated to
minimize L KL using Adam with the same learning rate of
10 −^3 , for up to 3000 additional epochs. Cluster centroids
are kept fixed, as in the original DEC formulation [ 2 ].
```

### Phase-Specific Training and Label Extraction

```
The above procedure is applied independently to each game
phase (In-Possession, Out-of-Possession, Positive Tran-
sition, and Negative Transition), yielding phase-specific
latent spaces and cluster structures. For all phases, the num-
ber of clusters is fixed to k =4, consistent with the evalu-
ation in Sect. 4. After convergence, final hard cluster labels
y ˆ i are obtained by taking the most probable cluster for each
instance:
```

```
y ˆ i =argmax
j
qij,
```

```
and these labels are used for downstream aggregation and
analysis in the main text.
```

### Training Diagnostics

```
The loss curves and latent-space visualization in Fig. 16
support the stability and effectiveness of DEC training. Both
the mean squared error (MSE) loss of the autoencoder and
the KL-divergence loss decrease rapidly and plateau, indi-
cating fast and stable convergence. The PCA projection of
the latent space shows well-separated and compact clusters,
further validating the discriminative power of the DEC-
encoded representations.
```

using the Adam optimizer [ 24 ] with a learning rate of 10 −^3 ,
batch training, and a maximum of 3000 epochs. The latent
dimensionality is set to _dz_ =10.

### Cluster Initialization

After pretraining, the encoder is used to obtain latent
embeddings _zi_ for all samples. Initial cluster centroids

{ _μ_ (0) _j_ } _kj_ =1 are computed by applying K-Means to the set

{ _zi_ } _Ni_ =1. These centroids serve as initialization for the sub-
sequent DEC refinement stage.

### KL-Based Refinement

DEC refines the encoder parameters by minimizing a KL-
divergence-based clustering loss between a soft assignment
distribution _Q_ =( _qij_ ) and a sharpened target distribution
_P_ =( _pij_ ) [ 2 ]. The soft assignment of sample _i_ to cluster _j_
is defined via a Student’s t-distribution kernel [ 22 ]:

_qij_ =

#### (

```
1+∥ zi − μj ∥^2 /α
```

```
)− α +1 2
∑
j ′(1+∥ zi − μj ′∥
```

(^2) _/α_ )− _α_ +1 2

#### ,

where _α_ is the degrees-of-freedom parameter (set to _α_ =
in our experiments). The target distribution _P_ is constructed
to emphasize confident assignments and normalize cluster
frequencies:

_pij_ =

```
qij^2 /
```

#### ∑

```
iqij
∑
j ′
```

#### (

```
q^2 ij ′ /
```

#### ∑

```
iqij ′
```

#### ).

The clustering objective is the KL divergence between _P_
and _Q_ :

**Fig. 16** Training dynamics and latent structure of the DEC model for the In-Possession game phase (first 100 epochs). **Left:** autoencoder (AE)
pretraining loss. **Middle:** KL-divergence loss during DEC optimization. **Right:** PCA projection of the learned latent representations

```
with the main results, DEC achieves superior performance
across all evaluation metrics and k values, demonstrating
strong robustness in modeling short, high-variability transi-
tion phases.
```

## Appendix C: Additional Evaluation Results

Figure 17 reports clustering performance for the Posi-
tive Transition and Negative Transition phases. Consistent

**Fig. 17** Evaluation of clustering algorithms across various _k_ values for Positive Transition (left) and Negative Transition (right) game phases.
Results are averaged over 5 random seeds

```
reinforcing the interpretation that the four clusters represent
broadly shared tactical patterns rather than competition-
specific phenomena.
Figure 18 complements this aggregate perspective by
visualizing the playing-style composition of individual
teams. Each horizontal bar represents a team and shows the
proportion of that team’s matches assigned to each clus-
ter. Teams are grouped by league to facilitate comparisons
within and across competitions. This visualization allows
stylistic consistency and variation to be observed more
directly: some teams display a dominant cluster across
most matches, indicating a relatively stable tactical identity,
whereas others exhibit a more balanced distribution across
clusters, suggesting greater tactical variability or adaptation
throughout the season. Together, the table and the figure
provide a comprehensive view of playing-style distribu-
tions, combining league-wide tendencies with team-level
stylistic profiles.
```

## Appendix D: League-Level and Team-Level

## Distribution of Playing Styles

Table 11 reports the distribution of playing-style clus-
ters across the five major European leagues at the match
level. Overall, the distributions appear relatively balanced
across competitions, with each cluster typically accounting
for roughly 20–30% of match-level assignments in every
league. This pattern suggests that the identified tactical
archetypes are broadly present across leagues rather than
being strongly league-specific, indicating that the clustering
captures general structural properties of team play.
Nevertheless, small differences between leagues can
still be observed. For instance, the Premier League shows a
slightly higher proportion of _Reactive Direct_ styles, whereas
Serie A exhibits a somewhat greater share of _Highly Proac-
tive_ play. Similarly, the _Balanced Proactive_ style appears
marginally more frequent in the Bundesliga and Ligue 1.
These variations, however, remain modest in magnitude,

**Table 11** Distribution of clusters across leagues based on all matches. Counts and percentages indicate how frequently each playing style appears
within each league
League Moderately Highly Reactive Balanced
Reactive Proactive Direct Proactive
Cnt % Cnt % Cnt % Cnt %
Bundesliga 151 24.67 122 19.93 154 25.16 185 30.23
La Liga 178 23.42 183 24.08 197 25.92 202 26.58
Ligue 1 188 24.74 175 23.03 169 22.24 228 30.00
Premier League 171 22.50 200 26.32 214 28.16 175 23.03
Serie A 144 18.95 228 30.00 186 24.47 202 26.58

**Fig. 18** Distribution of playing style clusters across all teams in the five major European leagues during the 2016–17 season. Each bar shows the
percentage of matches assigned to each cluster for a given team. Teams are grouped by league and colored by cluster membership

10. Gyarmati L, Kwak H, Rodriguez P. Searching for a unique style
    in soccer. arXiv preprint arXiv:1409.0308 (2014). h t t p s : / / d o i. o r g /
    1 0. 4 8 5 5 0 / a r X i v. 1 4 0 9. 0 3 0 8
11. Bialkowski A, Lucey P, Carr P, Yue Y, Sridharan S, Matthews I.
    Identifying team style in soccer using formations learned from
    spatiotemporal tracking data. In: _IEEE international conference_
    _on data mining workshops_ , pp. 9–14 (2014). h t t p s : / / d o i. o r g / 1 0. 1 1
    0 9 / I C D M W. 2 0 1 4. 1 6 7
12. Lopez-Valenciano A, Garcia-Gómez JA, López-Del Campo
    R, Resta R, Moreno-Perez V, Blanco-Pita H, et al. Associa-
    tion between offensive and defensive playing style variables
    and ranking position in a national football league. J Sports Sci.
    2022;40(1):50–8. h t t p s : / / d o i. o r g / 1 0. 1 0 8 0 / 0 2 6 4 0 4 1 4. 2 0 2 1. 1 9 7 6 4
    8 8.
13. Ruan L, Ge H, Shen Y, Pu Z, Zong S, Cui Y. Quantifying the
    effectiveness of defensive playing styles in the Chinese Football
    Super League. Front Psychol. 2022;13:899199. h t t p s : / / d o i. o r g / 1 0
    . 3 3 8 9 / f p s y g. 2 0 2 2. 8 9 9 1 9 9.
14. Chapman RM, McCrary JW. EP component identification and
    measurement by principal components analysis. Brain Cognit.
    1995;27(3):288–310. h t t p s : / / d o i. o r g / 1 0. 1 0 0 6 / b r c g. 1 9 9 5. 1 0 2 4.
15. Hennig C. An empirical comparison and characterisation
    of nine popular clustering methods. Adv Data Anal Classif.
    2022;16(1):201–29. h t t p s : / / d o i. o r g / 1 0. 4 8 5 5 0 / a r X i v. 2 1 0 2. 0 3 6 4 5.
16. Akhanli SE, Hennig C. Comparing clusterings and numbers of
    clusters by aggregation of calibrated clustering validity indexes.
    Stat Comput. 2020;30(5):1523–44. h t t p s : / / d o i. o r g / 1 0. 4 8 5 5 0 / a r X i
    v. 2 0 0 2. 0 1 8 2 2.
17. Agarwal S. Data mining: data mining concepts and techniques.
    In: _International conference on machine intelligence and research_
    _advancement_ , pp. 203–207 (2013). h t t p s : / / d o i. o r g / 1 0. 1 1 0 9 / i c m i r a
    . 2 0 1 3. 4 5
18. Hundal RS, Liu Z, Wadhwa B, Hou Z, Jiang K, Dong JS. Soccer
    strategy analytics using probabilistic model checkers. In: Inter-
    national sports analytics conference and exhibition, pp. 249–264
    (2024). h t t p s : / / d o i. o r g / 1 0. 1 0 0 7 / 9 7 8 - 3 - 0 3 1 - 6 9 0 7 3 - 0 \_ 2 2
19. Bandara I, Shelyag S, Rajasegarar S, Dwyer DB, Kim E, Ange-
    lova M. Time-series analysis of ball carrier open-space in asso-
    ciation football. In: _International sports analytics conference and_
    _exhibition_ , pp. 1–17 (2024). h t t p s : / / d o i. o r g / 1 0. 1 0 0 7 / s 4 2 9 7 9 - 0 2 5
    - 0 3 8 1 5 - 7
20. Schilling A, Anurathan J, Mühlberger J, Gerschner F, Rößle M,
    Theissler A, Klaiber M. Querying football matches for event data:
    towards using large language models. In: _International sports_
    _analytics conference and exhibition_ , pp. 216–227 (2024). h t t p s :
    / / d o i. o r g / 1 0. 1 0 0 7 / 9 7 8 - 3 - 0 3 1 - 6 9 0 7 3 - 0 \_ 1 9
21. Pappalardo L, Cintia P, Rossi A, Massucco E, Ferragina P, Pedre-
    schi D, et al. A public data set of spatio-temporal match events in
    soccer competitions. Sci Data. 2019;6(1):236. h t t p s : / / d o i. o r g / 1 0.
    1 0 3 8 / s 4 1 5 9 7 - 0 1 9 - 0 2 4 7 - 7.
22. van der Maaten L, Hinton G. Visualizing data using t-SNE. J
    Mach Learn Res, **9** (11) (2008).
23. Nair V, Hinton GE. Rectified linear units improve restricted
    Boltzmann machines. In: _Proceedings of the international con-_
    _ference on machine learning_ , pp. 807–814 (2010).
24. Kingma DP, Ba J. Adam: a method for stochastic optimization.
    arXiv preprint arXiv:1412.6980.
25. Dempster AP, Laird NM, Rubin DB. Maximum likelihood
    from incomplete data via the EM algorithm. J R Stat Soc B.
    1977;39(1):1–38.
26. Ng AY, Jordan MI, Weiss Y. On spectral clustering: analysis and
    an algorithm. In: _Advances in neural information processing sys-_
    _tems_ , pp. 849–856 (2002).
27. von Luxburg U. A tutorial on spectral clustering. Stat Comput.
    2007;17(4):395–416.

**Author Contributions** E.D. designed the study, implemented the meth-
odology, conducted the analysis, and wrote the manuscript. N.K.U.
and Y.H.Ş. contributed to the interpretation of results, supervision, and
manuscript revision. All authors read and approved the final manu-
script.

**Funding** The authors received no financial support for the research,
authorship, and/or publication of this article.

**Code Availability** The code used in this study is publicly available at h
t t p s : / / g i t h u b. c o m / e g e c j d e m i r / h o w _ f o o t b a l l _ t e a m s \_ p l a y.

**Data Availability** The datasets analyzed during the current study are
publicly available. References to the original data sources are provided
in the manuscript.

### Declarations

**Conflict of interest** On behalf of all authors, the corresponding author
states that there is no conflict of interest.

**Ethical Approval** Not applicable. This study uses publicly available,
anonymized data and does not involve human participants or animals.

## References

1. Demir E, Şahin YH, Üre NK. How do football teams play? A
   deep embedded clustering approach to reveal playing styles. In:
   Dong, J.S., Sun, J., Xie, X., Jiang, K. (eds.) _Sports Analytics_.
   ISACE 2025. Lecture Notes in Computer Science, vol. 15925.
   Springer, Cham (2026). h t t p s : / / d o i. o r g / 1 0. 1 0 0 7 / 9 7 8 - 3 - 0 3 2 - 0 6 1 6
   7 - 6 \_ 4
2. Xie J, Girshick R, Farhadi A. Unsupervised deep embedding for
   clustering analysis. In: _Proceedings of the international confer-_
   _ence on machine learning (ICML)_ , pp. 478–487 (2016). h t t p s : / / d
   o i. o r g / 1 0. 4 8 5 5 0 / a r X i v. 1 5 1 1. 0 6 3 3 5
3. Lundberg SM, Lee S-I. A unified approach to interpreting model
   predictions. In: Advances in neural information processing sys-
   tems (NeurIPS), vol. 30 (2017). h t t p s : / / d o i. o r g / 1 0. 4 8 5 5 0 / a r X i v. 1
   7 0 5. 0 7 8 7 4
4. Rousseeuw PJ. Silhouettes: a graphical aid to the interpreta-
   tion and validation of cluster analysis. J Comput Appl Math.
   1987;20:53–65. h t t p s : / / d o i. o r g / 1 0. 1 0 1 6 / 0 3 7 7 - 0 4 2 7 ( 8 7 ) 9 0 1 2 5 - 7.
5. Moffatt SJ, Gupta R, Rakshit S, Keller BS. Identifying team play-
   ing styles across phases of play: a user-specific cluster framework.
   In: _International Sports Analytics Conference and Exhibition_ , pp.
   129–136 (2024). h t t p s : / / d o i. o r g / 1 0. 1 0 0 7 / 9 7 8 - 3 - 0 3 1 - 6 9 0 7 3 - 0 \_ 1 1
6. Born Z. _Tactical performance insights for Australian rules foot-_
   _ball using deep learning_. Master’s thesis, The University of West-
   ern Australia (2022). h t t p s : / / d o i. o r g / 1 0. 2 6 1 8 2 / 3 s v 1 - h 0 0 9
7. Plakias S, Moustakidis S, Kokkotis C, Tsatalas T, Papalexi M,
   Plakias D, et al. Identifying soccer teams’ styles of play: a scoping
   and critical review. J Funct Morphol Kinesiol. 2023;8(2):39. h t t p s
   : / / d o i. o r g / 1 0. 3 3 9 0 / j f m k 8 0 2 0 0 3 9.
8. Diquigiovanni J, Scarpa B. Analysis of association football play-
   ing styles: an innovative method to cluster networks. Stat Model.
   2019;19(1):28–54. h t t p s : / / d o i. o r g / 1 0. 1 1 7 7 / 1 4 7 1 0 8 2 X 1 8 8 0 8 6 2 8.
9. Peña JL, Touchette H. A network theory analysis of football strat-
   egies. arXiv preprint arXiv:1206.6904 (2012). h t t p s : / / d o i. o r g / 1 0.
   4 8 5 5 0 / a r X i v. 1 2 0 6. 6 9 0 4

10. Mann HB, Whitney DR. On a test of whether one of two random
    variables is stochastically larger than the other. Ann Math Stat.
    1947;18(1):50–60.
11. Efron B, Tibshirani RJ. _An introduction to the bootstrap_. Chap-
    man and Hall/CRC, New York (1994). h t t p s : / / d o i. o r g / 1 0. 1 2 0 1 / 9 7
    8 0 4 2 9 2 4 6 5 9 3

```
Publisher's Note Springer Nature remains neutral with regard to juris-
dictional claims in published maps and institutional affiliations.
```

```
Springer Nature or its licensor (e.g. a society or other partner) holds
exclusive rights to this article under a publishing agreement with the
author(s) or other rightsholder(s); author self-archiving of the accepted
manuscript version of this article is solely governed by the terms of
such publishing agreement and applicable law.
```

28. Strehl A, Ghosh J. Cluster ensembles: a knowledge reuse frame-
    work for combining multiple partitions. J Mach Learn Res.
    2002;3:583–617.
29. Hubert L, Arabie P. Comparing partitions. J Classif.
    1985;2(1):193–218. h t t p s : / / d o i. o r g / 1 0. 1 0 0 7 / B F 0 1 9 0 8 0 7 5.
30. Hastie T, Friedman J, Tibshirani R. _The elements of statisti-_
    _cal learning: data mining, inference, and prediction_ , 2nd ed.
    Springer, New York (2009). h t t p s : / / d o i. o r g / 1 0. 1 0 0 7 / 9 7 8 - 0 - 3 8 7 - 8
    4 8 5 8 - 7
31. Chen T, Guestrin C. XGBoost: a scalable tree boosting system.
    In: _Proceedings of the ACM SIGKDD international conference_
    _on knowledge discovery and data mining_ , pp. 785–794 (2016). h t
    t p s : / / d o i. o r g / 1 0. 1 1 4 5 / 2 9 3 9 6 7 2. 2 9 3 9 7 8 5
32. Ke G, Meng Q, Finley T, Wang T, Chen W, Ma W, Ye Q, Liu T-Y.
    LightGBM: a highly efficient gradient boosting decision tree. In:
    _Advances in neural information processing systems_ (2017).
33. Spearman C. The proof and measurement of association between
    two things. Am J Psychol. 1904;15(1):72–101. h t t p s : / / d o i. o r g / 1 0.
    2 3 0 7 / 1 4 1 2 1 5 9.
