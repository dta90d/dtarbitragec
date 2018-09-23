#!/usr/bin/env perl

# CAMParse/DrawChart.pm
# Written by dta90d on 2017.09.04.
##################################
### Creating charts for CAMParse #
##################################

package CAMParse::DrawChart;

use Modern::Perl '2015';
use autodie;

our (@ISA, @EXPORT, @EXPORT_OK);
BEGIN {
    require Exporter;
    @ISA       = qw(Exporter);
    @EXPORT    = qw();
    @EXPORT_OK = qw();
}

use Chart::Clicker;
use Chart::Clicker::Data::Series;
use Chart::Clicker::Data::DataSet;
use Chart::Clicker::Axis;
use Chart::Clicker::Axis::DateTime;

# Draw one coin spread line chart.
sub one_coin_spread {
    my ($data, $coin, $high_market, $low_market) = @_; # get all data.
    
    # Select data needed.
    my (@time_x, @spreads_y); # For axis.
    
    for (@$data) {
        # Throw away unnecessary data
        next unless $_->{coin} =~ /$coin/
                and $_->{high_market} =~ /$high_market/
                and $_->{low_market} =~ /$low_market/;
        # Save results in axis arrays.
        push @time_x, $_->{time} and push @spreads_y, $_->{spread}
				 or  die  "Something went wrong.";
    }
    
    # Validate data.
    return 0 if ($#time_x != $#spreads_y)
              ||($#time_x <= 1);
    
    # Draw the chart.
    my $chart = Chart::Clicker->new(
        format => 'pdf',
        width  => 2500,
        height => 1000,
    );
    $chart->title->text();
    
    my $series = Chart::Clicker::Data::Series->new(
        name   => "$coin spreads",
        keys   => \@time_x,
        values => \@spreads_y,
    );
    my $dataset = Chart::Clicker::Data::DataSet->new(
        series => [ $series ],
    );
    
    my $ctx = $chart->get_context('default');
    $ctx->domain_axis(
        Chart::Clicker::Axis::DateTime->new(
            label            => 'Time',
            position         => 'bottom',
            orientation      => 'horizontal',
            ticks            => 24,
            tick_label_angle => 0.785398163,
            format           => "%H:%M:%S %d-%m-%Y",
        )
     );
     $ctx->range_axis(
        Chart::Clicker::Axis->new(
            label       => 'Spread',
            position    => 'left',
            orientation => 'vertical',
            ticks       => 45,
        )
    );
    
    $chart->add_to_datasets($dataset);
    
    my $dirname  = "Charts";
    my $filename = $coin."_".$high_market."-".$low_market.".pdf";
    $chart->write_output("$dirname/$filename");
}

1;
