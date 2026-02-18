def lbw_decision(impact, trajectory):

    pitching_in_line = impact["in_line"]
    hitting_wicket = trajectory["hitting"]

    if pitching_in_line and hitting_wicket:
        return "OUT", 0.92

    return "NOT OUT", 0.76
