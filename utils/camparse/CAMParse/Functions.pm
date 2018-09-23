#!/usr/bin/perl

# CAMParse/Functions.pm
# Written by dta90d on 2017.09.12.
###############################
# Functions for the CAMParser.#
###############################

package CAMParse::Functions;

use Modern::Perl '2015';
use autodie;

use DateTime;
use DateTime::Format::ISO8601;

our (@ISA, @EXPORT, @EXPORT_OK);
BEGIN {
    require Exporter;
    @ISA    = qw(Exporter);
    @EXPORT = qw(get_all_data get_coins print_spread print_max_spread);
}

# Main loop parsing function for everything
sub eval_parsing {
    my ( $json_data, $_function, @options ) = @_;
    
    my @res; # save results here
    
    for my $try (@$json_data) {
        my $time_of_a_try = $try->[0]; # save the time of the result
        
        for my $data (@$try) {
            next unless ref $data; # if is an object
            
            my $val = $_function->($data, $time_of_a_try, @options, \@res);
            push @res, $val unless $val eq 'false';
        }
    }
    return @res;
}

# Get coins' names.
sub get_coins {
    my $json_data = shift;
    
    return eval_parsing($json_data, sub {
        my $coin_arr = pop;
        my ($result, $time) = @_;
        
        my $coin = $result->{coin};
        return 'false' if grep {/$coin/} @$coin_arr;
        return $coin;
    });
}

# Get the spread of each coin:
sub print_spread {
    my ($json_data, $required_coins) = @_;
    
    for my $coin (@$required_coins) {
        # Get the spread:
        eval_parsing($json_data, sub {
            pop; # throw away the returning array
            my ($result, $time, $coin) = @_;
            my $spread = $result->{spread};
            
            if ($result->{coin} =~ /$coin/) {
                say "Spread of $coin is $spread at $time.";
            }
        }, $coin);
    }
}

# TODO: Not taking into account the direction of a spread!
# TODO: Add time distinquishing!
sub print_max_spread {
    my ($json_data, $required_coins, $ratio) = @_;
    $ratio = 0 unless $ratio; # default 0
    
    for my $coin (@$required_coins) {
        my @spreads; # save spreads here
        
        # Get the spread foreach try:
        @spreads = eval_parsing($json_data, sub {
            pop; # throw away the returning array
            my ($result, $time, $coin) = @_;
            my $spread = ($result->{spread} - 1) * 100 ;
            
            return 'false' if $result->{coin} !~ /$coin/;
            return $spread;
        }, $coin);
        
        # Sort spreads:
        @spreads = sort @spreads;
        my ($min, $max) = ($spreads[0], $spreads[$#spreads-1]);
        my $diff = $max - $min;
        if ($diff >= $ratio) {
            say "Spread of $coin is from $min% to $max%.";
            say "Difference is equal $diff%."
        }
    }
}

# Get all data needed for drawing a chart
sub get_all_data {
    my ($json_data, $coin_arr) = @_;
    
    my @data; # save data here.
    
    @data = eval_parsing($json_data, sub {
        pop; # throw away resulting array
        my ($result, $time) = @_;
        
        my $unix_timestamp = DateTime::Format::ISO8601->parse_datetime($time)
                                                  ->epoch;
        my $coin            = $result->{coin};
        my $spread          = $result->{spread};
        my $high_market     = $result->{high_market}->{name};
        my $low_market      = $result->{low_market}->{name};
        my $high_market_bid = $result->{high_market}->{bid};
        my $high_market_ask = $result->{high_market}->{ask};
        my $low_market_bid  = $result->{low_market}->{bid};
        my $low_market_ask  = $result->{low_market}->{ask};
        
        my $val = {
            time            => $unix_timestamp,
            coin            => $coin,
            spread          => $spread,
            high_market     => $high_market,
            low_market      => $low_market,
            high_market_bid => $high_market_bid,
            high_market_ask => $high_market_ask,
            low_market_bid  => $low_market_bid,
            low_market_ask  => $low_market_ask,
        };
        return 'false' unless $val;
        return $val;
    });
    
    return @data;
}

# Parse the spreads of a coin for the market pair.
# Arguments: $data --> Array ref; $coin --> string coin name.
# Return: new DATA ARRAY.
sub parse_spreads {
    my ($data, $coin) = @_;
    #say $coin;#TODO:REMOVE
    
    my ($high_market, $low_market); # save here high - low difference
    for (@$data) {
        next unless $_->{coin} =~ /$coin/;
        my $spread = $_->{spread};
        unless ($high_market && $low_market) {
            $high_market = $_->{high_market};
            $low_market  = $_->{low_market};
        }
        #print $_->{high_market}; #TODO:REMOVE
        #print "$spread -> $_->{high_market}\n";#TODO:REMOVE
        if ($high_market ne $_->{high_market}
        and $low_market  ne $_->{low_market}) {
            $spread *= -1;
            $_->{high_market} = $high_market;
            $_->{low_market}  = $low_market;
        }#print "$spread -> $_->{high_market}\n";#TODO:REMOVE
        $_->{spread} = $spread;
    }
}

1;
